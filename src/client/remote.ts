import type { BBotClient, BotState, Snapshot, Settings, InstanceStatus, JobStatus, AccountKind, TradeState, TradeClickRequest, PartyCommandResult, Account, MicrosoftAuthChallenge, SessionAccountInput, FleetActionResult, JobCreateInput, Job } from './types';
import { defaultServerConnection, type ServerConnection, type ReconnectResult } from './serverConnection';

type Wire = { version:number; bots:Array<{id:string;accountId?:string;accountLabel:string;minecraftName?:string;state:BotState;startQueued?:boolean;instanceId?:string;jobId?:string;position?:{x:number;y:number;z:number};kickReason?:string;kickedAt?:number}>;
  instances:Snapshot['instances'];jobs?:Snapshot['jobs'];performance?:Snapshot['performance'];carePackages?:Snapshot['carePackages'];logs:Array<{id:number;at:number;level:string;message:string;botId?:string;instanceId?:string;kickReason?:string}>;
  viewer:{botId:string;url:string}|null;accounts?:Snapshot['accounts'];serverConnection?:Snapshot['serverConnection'] };
const unsupported = ():never => {throw Error('この操作は実Botではまだ利用できません')};
const idleTrade = ():TradeState => ({status:'IDLE',tradeSessionId:null,targetUsername:null,revision:0,window:null});
export class RemoteBBotClient implements BBotClient {
  readonly mode='remote' as const;
  private current:Snapshot={bots:[],instances:[],jobs:[],accounts:[],logs:[],settings:{maxBots:1,pathConcurrency:2,eventPollingSeconds:10,debug:false,javaVersion:'1.8.9'},serverConnection:defaultServerConnection,trades:{},revision:0,viewer:null,remoteConnected:false};
  private listeners=new Set<()=>void>();
  private socket?:WebSocket;
  private failures=0;
  private lastRevision=0;
  constructor(){void this.refresh();this.open();window.setInterval(()=>{if(this.socket?.readyState!==WebSocket.OPEN)void this.refresh()},1000);}
  getSnapshot=()=>this.current;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener)};
  private connected(value:boolean){if(this.current.remoteConnected===value)return;this.current={...this.current,remoteConnected:value};this.listeners.forEach(listener=>listener())}
  private apply(data:Wire){
    if(data?.version!==1||!Array.isArray(data.bots)||!Array.isArray(data.instances)||!Array.isArray(data.logs))return;
    const kicks=new Map(data.logs.filter(l=>l.kickReason).map(l=>[l.botId,l.kickReason]));
    this.current={...this.current,revision:++this.lastRevision,viewer:data.viewer,instances:data.instances,jobs:data.jobs??[],performance:data.performance,carePackages:data.carePackages,
      settings:{...this.current.settings,maxBots:data.bots.length},
      serverConnection:data.serverConnection??this.current.serverConnection,
      bots:data.bots.map(b=>({id:b.id,accountId:b.accountId??'',name:b.minecraftName??b.accountLabel,state:b.state,startQueued:b.startQueued,instanceId:b.instanceId,jobId:b.jobId,
        x:b.position?.x??0,y:b.position?.y??0,z:b.position?.z??0,updatedAt:Date.now(),kickReason:b.kickReason??kicks.get(b.id),kickedAt:b.kickedAt})),
      accounts:data.accounts??[],
      logs:data.logs.map(l=>({id:l.id,at:l.at,level:l.level==='WARN'?'WARN' as const:l.level==='ERROR'?'ERROR' as const:'INFO' as const,
        message:l.kickReason?`${l.message}: ${l.kickReason}`:l.message,botId:l.botId,instanceId:l.instanceId}))};
    this.listeners.forEach(listener=>listener());
  }
  private async refresh(){try{const r=await fetch('/api/v1/status',{headers:{'X-BBot-UI':'1'},credentials:'same-origin',cache:'no-store'});if(r.ok){this.apply(await r.json() as Wire);this.connected(true);return true}}catch{/* Keep polling while WebSocket is unavailable. */}return false}
  private open(){
    const url=new URL('/api/v1/events',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const socket=new WebSocket(url);this.socket=socket;
    socket.onmessage=event=>{try{const packet=JSON.parse(event.data as string) as {type:string;data:Wire};if(packet.type==='snapshot')this.apply(packet.data)}catch{/* Ignore invalid packets. */}};
    socket.onopen=()=>{this.failures=0;this.connected(true)};
    socket.onclose=()=>{if(this.socket!==socket)return;void this.refresh().then(ok=>{if(!ok)this.connected(false)});setTimeout(()=>{this.open()},Math.min(1000*2**this.failures++,10000))};
  }
  private async action(id:string,name:'connect'|'join-pit'|'disconnect'){
    if(!/^bot-[1-9]\d*$/.test(id))throw Error('無効なBot IDです');
    const r=await fetch(`/api/v1/bots/${id}/actions/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});
    const data=await r.json().catch(()=>null) as (Wire|{error?:string}|null);
    if(!r.ok){
      const code=data&&'error'in data?data.error:undefined;
      if(code==='SESSION_AUTH_REQUIRED')await this.refresh();
      const message=code==='ACCOUNT_REQUIRED'?'AccountがBotに割り当てられていません':
        code==='SESSION_AUTH_REQUIRED'?'Session Tokenが無効または期限切れです。AccountsからReplace Tokenしてください':
        code==='INVALID_STATE'?'現在のBot stateでは操作できません':
        code==='CONFLICT'?'設定変更または認証処理中です。少し待って再試行してください':
        r.status===404?'Botが見つかりません':'操作に失敗しました';
      throw Error(message);
    }
    this.apply(data as Wire);
  }
  async startBot(id:string){
    const bot=this.current.bots.find(b=>b.id===id);
    if(!bot)throw Error('Botが見つかりません');
    if(!bot.accountId){
      const candidates=this.current.accounts.filter(a=>a.status==='READY'&&(a.assignedBot===undefined||a.assignedBot===id));
      if(candidates.length===1)await this.assignAccount(id,candidates[0]!.id);
      else if(candidates.length===0)throw Error('READYのAccountを追加してからStartしてください');
      else throw Error('Accountsで使用するAccountをBotに割り当ててください');
    }
    return this.action(id,'connect');
  }
  stopBot(id:string){return this.action(id,'disconnect')}
  async startAssignedBots(){
    const r=await fetch('/api/v1/fleet/actions/start-assigned',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});
    const data=await r.json().catch(()=>null) as (FleetActionResult|{error?:string}|null);
    if(!r.ok)throw Error(r.status===409?'設定変更または認証処理中です。少し待って再試行してください':'複数BotのStartに失敗しました');
    await this.refresh();
    return data as FleetActionResult;
  }
  async stopAllBots(){
    const r=await fetch('/api/v1/fleet/actions/stop-all',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});
    const data=await r.json().catch(()=>null) as (FleetActionResult|{error?:string}|null);
    if(!r.ok)throw Error('複数BotのStopに失敗しました');
    await this.refresh();
    return data as FleetActionResult;
  }
  joinPit(id:string){return this.action(id,'join-pit')}
  getServerConnection=()=>this.current.serverConnection;
  private async request(path:string,method:'POST'|'PUT',body:object){
    const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
    if(!r.ok){const errors:Record<number,string>={400:'入力を確認してください',404:'対象が見つかりません',409:'Bot稼働中、または競合があります',422:'この認証方式は対応していません'};throw Error(errors[r.status]??'backendで操作に失敗しました')}
    return r.json() as Promise<unknown>;
  }
  async saveServerConnection(next:ServerConnection){
    const record=await this.request('/api/v1/settings/server','PUT',next) as Snapshot['serverConnection'];
    this.current={...this.current,serverConnection:record};this.listeners.forEach(listener=>listener());return record;
  }
  async addMicrosoftAccount(label:string){
    const account=await this.request('/api/v1/accounts','POST',{kind:'MICROSOFT',label}) as Account;
    await this.refresh();
    return account;
  }
  async addSessionAccount(input:SessionAccountInput){
    const r=await fetch('/api/v1/accounts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({kind:'SESSION',...input}),credentials:'same-origin'});
    const data=await r.json().catch(()=>null) as (Account|{error?:string}|null);
    if(!r.ok){
      const code=data&&'error'in data?data.error:undefined;
      if(code==='INVALID_SESSION_TOKEN')throw Error('Minecraft Access Tokenが無効、期限切れ、またはMinecraftプロフィールを取得できません');
      throw Error(r.status===400?'入力を確認してください':r.status===409?'同じlabelのAccountがあります':'Session Accountの追加に失敗しました');
    }
    await this.refresh();
    return data as Account;
  }
  async replaceSessionToken(accountId:string,accessToken:string){
    if(!/^[0-9a-f-]{36}$/.test(accountId))throw Error('無効なAccount IDです');
    const r=await fetch(`/api/v1/accounts/${accountId}/session-token`,{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({accessToken}),credentials:'same-origin'});
    const data=await r.json().catch(()=>null) as (Account|{error?:string}|null);
    if(!r.ok){
      const code=data&&'error'in data?data.error:undefined;
      if(code==='INVALID_SESSION_TOKEN')throw Error('Minecraft Access Tokenが無効、期限切れ、またはMinecraftプロフィールを取得できません');
      if(code==='PROFILE_MISMATCH')throw Error('このTokenは別のMinecraft Accountのものです');
      if(code==='INVALID_STATE')throw Error('使用中のBotをStopしてからTokenを更新してください');
      if(code==='UNKNOWN_ACCOUNT')throw Error('Session Accountが見つかりません');
      throw Error(r.status===400?'入力を確認してください':'Session Tokenの更新に失敗しました');
    }
    await this.refresh();
    return data as Account;
  }
  async getMicrosoftAuthChallenge(accountId:string){
    if(!/^[0-9a-f-]{36}$/.test(accountId))throw Error('無効なAccount IDです');
    const r=await fetch(`/api/v1/accounts/${accountId}/auth-challenge`,{credentials:'same-origin',cache:'no-store'});
    if(!r.ok)throw Error('Microsoft認証情報の取得に失敗しました');
    const data=await r.json() as {challenge:MicrosoftAuthChallenge|null};
    return data.challenge??null;
  }
  async retryAccount(accountId:string){
    if(!/^[0-9a-f-]{36}$/.test(accountId))throw Error('無効なAccount IDです');
    await this.request(`/api/v1/accounts/${accountId}/actions/retry-auth`,'POST',{});await this.refresh();
  }
  async assignAccount(botId:string,accountId:string|null){
    if(!/^bot-[1-9]\d*$/.test(botId))throw Error('無効なBot IDです');
    await this.request(`/api/v1/bots/${botId}/account`,'PUT',{accountId});await this.refresh();
  }
  async submitJob(input:JobCreateInput):Promise<Job>{
    const job=await this.request('/api/v1/jobs','POST',input) as Job;
    await this.refresh();
    return job;
  }
  async deleteAccount(accountId:string){
    if(!/^[0-9a-f-]{36}$/.test(accountId))throw Error('無効なAccount IDです');
    const r=await fetch(`/api/v1/accounts/${accountId}`,{method:'DELETE',credentials:'same-origin'});
    if(!r.ok){const errors:Record<number,string>={404:'Accountが見つかりません',409:'使用中のAccountはStopしてから削除してください'};throw Error(errors[r.status]??'Accountの削除に失敗しました')}
    await this.refresh();
  }
  reconnectServer(_revision:number):ReconnectResult{return unsupported()}
  getTradeState=(_id:string)=>idleTrade();
  startTrade(_id:string,_username:string):void{unsupported()}
  clickTradeSlot(_id:string,_request:TradeClickRequest):void{unsupported()}
  cancelTrade(_id:string):void{unsupported()}
  simulateTradeTimeout(_id:string):void{unsupported()}
  inviteParty(_id:string,_username:string):PartyCommandResult{return unsupported()}
  warpParty(_id:string):PartyCommandResult{return unsupported()}
  recoverBot(_id:string):void{unsupported()}
  setBotState(_id:string,_state:BotState):void{unsupported()}
  createBots(_count:number):void{unsupported()}
  addInstance():void{unsupported()}
  setInstanceStatus(_id:string,_status:InstanceStatus):void{unsupported()}
  addAccount(_label:string,_kind:AccountKind):void{unsupported()}
  createJob(_id:string):void{unsupported()}
  setJobState(_id:string,_state:JobStatus):void{unsupported()}
  updateSettings(_next:Partial<Settings>):void{unsupported()}
  reset():void{unsupported()}
}
