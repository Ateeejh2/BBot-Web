import type { BBotClient, BotState, Snapshot, Settings, InstanceStatus, JobStatus, AccountKind, TradeState, TradeClickRequest, PartyCommandResult } from './types';
import { defaultServerConnection, type ServerConnection, type ReconnectResult } from './serverConnection';

type Wire = { version:number; bots:Array<{id:string;accountLabel:string;state:BotState;instanceId?:string;position?:{x:number;y:number;z:number}}>;
  instances:Snapshot['instances'];logs:Array<{id:number;at:number;level:string;message:string;botId?:string;instanceId?:string;kickReason?:string}>;
  viewer:{botId:string;url:string}|null };
const unsupported = ():never => {throw Error('この操作は実Botではまだ利用できません')};
const idleTrade = ():TradeState => ({status:'IDLE',tradeSessionId:null,targetUsername:null,revision:0,window:null});
export class RemoteBBotClient implements BBotClient {
  readonly mode='remote' as const;
  private current:Snapshot={bots:[],instances:[],jobs:[],accounts:[],logs:[],settings:{maxBots:1,pathConcurrency:2,eventPollingSeconds:10,debug:false,javaVersion:'1.8.9'},serverConnection:defaultServerConnection,trades:{},revision:0,viewer:null};
  private listeners=new Set<()=>void>();
  private socket?:WebSocket;
  private failures=0;
  private lastRevision=0;
  constructor(){void this.refresh();this.open();}
  getSnapshot=()=>this.current;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener)};
  private apply(data:Wire){
    if(data?.version!==1||!Array.isArray(data.bots)||!Array.isArray(data.instances)||!Array.isArray(data.logs))return;
    const kicks=new Map(data.logs.filter(l=>l.kickReason).map(l=>[l.botId,l.kickReason]));
    this.current={...this.current,revision:++this.lastRevision,viewer:data.viewer,instances:data.instances,
      bots:data.bots.map(b=>({id:b.id,accountId:b.id,name:b.accountLabel,state:b.state,instanceId:b.instanceId,
        x:b.position?.x??0,y:b.position?.y??0,z:b.position?.z??0,updatedAt:Date.now(),kickReason:kicks.get(b.id)})),
      accounts:data.bots.map(b=>({id:b.id,label:b.accountLabel,kind:'MICROSOFT' as const,status:'READY' as const,createdAt:0})),
      logs:data.logs.map(l=>({id:l.id,at:l.at,level:l.level==='WARN'?'WARN' as const:l.level==='ERROR'?'ERROR' as const:'INFO' as const,
        message:l.kickReason?`${l.message}: ${l.kickReason}`:l.message,botId:l.botId,instanceId:l.instanceId}))};
    this.listeners.forEach(listener=>listener());
  }
  private async refresh(){try{const r=await fetch('/api/v1/status',{headers:{'X-BBot-UI':'1'},credentials:'same-origin',cache:'no-store'});if(r.ok)this.apply(await r.json() as Wire)}catch{/* WebSocket reconnects. */}}
  private open(){
    const url=new URL('/api/v1/events',window.location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const socket=new WebSocket(url);this.socket=socket;
    socket.onmessage=event=>{try{const packet=JSON.parse(event.data as string) as {type:string;data:Wire};if(packet.type==='snapshot')this.apply(packet.data)}catch{/* Ignore invalid packets. */}};
    socket.onopen=()=>{this.failures=0};
    socket.onclose=()=>{if(this.socket!==socket)return;setTimeout(()=>{void this.refresh();this.open()},Math.min(1000*2**this.failures++,10000))};
  }
  private async action(id:string,name:'connect'|'join-pit'|'disconnect'){
    if(!/^bot-[1-9]\d*$/.test(id))throw Error('無効なBot IDです');
    const r=await fetch(`/api/v1/bots/${id}/actions/${name}`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});
    if(!r.ok)throw Error(r.status===409?'現在のBot stateでは操作できません':r.status===404?'Botが見つかりません':'操作に失敗しました');
    this.apply(await r.json() as Wire);
  }
  startBot(id:string){return this.action(id,'connect')}
  stopBot(id:string){return this.action(id,'disconnect')}
  joinPit(id:string){return this.action(id,'join-pit')}
  getServerConnection=()=>this.current.serverConnection;
  saveServerConnection(_next:ServerConnection):never{return unsupported()}
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
