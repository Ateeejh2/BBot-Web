import { botStates, validMinecraftUsername, type AccountKind, type BBotClient, type Bot, type BotState, type InstanceStatus, type JobStatus, type Settings, type Snapshot, type TradeClickRequest, type TradeItem, type TradeState, type TradeWindow } from './types';
const stamp = Date.now();
const initial = ():Snapshot => ({
  bots: [
    {id:'bot-01',accountId:'acc-01',name:'Scout-01',state:'IN_PIT_IDLE',instanceId:'mega10c',x:31,y:66,z:-204,updatedAt:stamp},
    {id:'bot-02',accountId:'acc-02',name:'Scout-02',state:'PATHFINDING',instanceId:'mini02',jobId:'job-021',x:-87,y:72,z:118,updatedAt:stamp},
    {id:'bot-03',accountId:'acc-03',name:'Scout-03',state:'RECOVERING',x:0,y:64,z:0,updatedAt:stamp},
    {id:'bot-04',accountId:'acc-04',name:'Scout-04',state:'LOBBY',x:12,y:64,z:8,updatedAt:stamp},
    {id:'bot-05',accountId:'acc-05',name:'Scout-05',state:'WORKING',instanceId:'mega10c',jobId:'job-018',x:128,y:70,z:-44,updatedAt:stamp},
    {id:'bot-06',accountId:'acc-06',name:'Scout-06',state:'DISCONNECTED',x:0,y:64,z:0,updatedAt:stamp},
  ],
  instances:[
    {id:'mega10c',status:'ACTIVE',firstSeen:stamp-86400000,lastSeen:stamp-4000,metadata:'Pit backend'},
    {id:'mini02',status:'ACTIVE',firstSeen:stamp-7200000,lastSeen:stamp-11000,metadata:'Pit backend'},
    {id:'mega03a',status:'SUSPECT',firstSeen:stamp-3600000,lastSeen:stamp-180000,metadata:'同時離脱を検知'},
    {id:'mini09',status:'INACTIVE',firstSeen:stamp-172800000,lastSeen:stamp-7200000,metadata:'観測なし'},
  ],
  jobs:[
    {id:'job-018',eventType:'Care Package',instanceId:'mega10c',state:'RUNNING',botId:'bot-05',x:128,y:70,z:-44,expiresAt:stamp+240000},
    {id:'job-021',eventType:'Supply Drop',instanceId:'mini02',state:'ASSIGNED',botId:'bot-02',x:-64,y:72,z:141,expiresAt:stamp+420000},
    {id:'job-022',eventType:'Event Watch',instanceId:'mega10c',state:'QUEUED',x:18,y:65,z:-180,expiresAt:stamp+660000},
    {id:'job-012',eventType:'Event Watch',instanceId:'mini09',state:'COMPLETED',botId:'bot-01',x:20,y:64,z:91,expiresAt:stamp-300000},
  ],
  accounts:Array.from({length:6},(_,i)=>({id:`acc-0${i+1}`,label:`Session ${String(i+1).padStart(2,'0')}`,kind:'SESSION' as const,status:'READY' as const,createdAt:stamp-86400000})),
  logs:[
    {id:1,at:stamp-8000,level:'INFO',message:'Mock データを読み込みました'},
    {id:2,at:stamp-7200,level:'INFO',message:'Bot が instance に入りました',botId:'bot-01',instanceId:'mega10c'},
    {id:3,at:stamp-6300,level:'INFO',message:'Job を割り当てました',botId:'bot-02',instanceId:'mini02',jobId:'job-021'},
    {id:4,at:stamp-4000,level:'WARN',message:'Instance の状態を SUSPECT に変更しました',instanceId:'mega03a'},
  ],
  settings:{maxBots:20,pathConcurrency:2,eventPollingSeconds:10,debug:false,javaVersion:'1.8.9'},trades:{},revision:0
});
const availableStates = new Set<string>(botStates);
const idleTrade = ():TradeState => ({status:'IDLE',tradeSessionId:null,targetUsername:null,revision:0,window:null});
const item = (name:string,count:number,lore:string[],icon:string):TradeItem => ({name,count,lore,icon});
const mockWindow = (windowId:number):TradeWindow => {
  const slots:(TradeItem|null)[]=Array(27).fill(null), inventory:(TradeItem|null)[]=Array(27).fill(null), hotbar:(TradeItem|null)[]=Array(9).fill(null);
  inventory[0]=item('Diamond Sword',1,['Sharpness II','Mock item'],'⚔');inventory[4]=item('Golden Apple',3,['A shiny mock apple'],'●');hotbar[0]=item('Iron Sword',1,['Practice weapon'],'⚔');
  return {windowId,title:'Mock Trade',type:'minecraft:chest',slotCount:27,slots,inventory,hotbar};
};
export class MockBBotClient implements BBotClient {
  readonly mode = 'mock';
  private snapshot:Snapshot = initial();
  private listeners = new Set<()=>void>();
  private sequence = 100;
  private tradeGeneration = new Map<string,number>();
  private nextGeneration(id:string){const n=(this.tradeGeneration.get(id)??0)+1;this.tradeGeneration.set(id,n);return n;}
  getTradeState = (id:string):TradeState => this.snapshot.trades[id]??idleTrade();
  startTrade(id:string,targetUsername:string){
    if(!validMinecraftUsername(targetUsername))throw Error('Minecraft username は1〜16文字の英数字と _ のみです');
    this.getBot(this.snapshot,id);
    if(['REQUESTING','WAITING_FOR_GUI','OPEN'].includes(this.getTradeState(id).status))throw Error('このBotではTradeが進行中です');
    const generation=this.nextGeneration(id),sessionId=`mock-trade-${id}-${generation}`;
    this.update(s=>{s.trades[id]={status:'WAITING_FOR_GUI',tradeSessionId:sessionId,targetUsername,revision:this.getTradeState(id).revision+1,window:null};});
    setTimeout(()=>{if(this.tradeGeneration.get(id)!==generation)return;
      this.update(s=>{const t=s.trades[id];if(t?.tradeSessionId!==sessionId||t.status!=='WAITING_FOR_GUI')return;t.status='OPEN';t.window=mockWindow(generation);t.revision++;});
    },850);
  }
  clickTradeSlot(id:string,request:TradeClickRequest){
    const t=this.getTradeState(id),w=t.window;
    if(t.status!=='OPEN'||!w)throw Error('Trade GUI は開いていません');
    if(request.tradeSessionId!==t.tradeSessionId)throw Error('古いTrade sessionです');
    if(request.windowId!==w.windowId)throw Error('古いwindowIdです');
    if(!Number.isInteger(request.revision)||request.revision!==t.revision)throw Error('Trade snapshotが古いです');
    if(!Number.isInteger(request.slot)||request.slot<0||request.slot>=w.slotCount+36)throw Error('無効なslotです');
    const {tradeSessionId,windowId,revision,slot}=request;
    // The mock server acknowledges a click asynchronously; the UI never moves an item locally.
    setTimeout(()=>{const latest=this.getTradeState(id);
      if(latest.status!=='OPEN'||latest.tradeSessionId!==tradeSessionId||latest.window?.windowId!==windowId||latest.revision!==revision)return;
      this.update(s=>{const trade=s.trades[id],window=trade.window!;const index=slot-window.slotCount;
        if(index>=0){const source=index<27?window.inventory:window.hotbar,sourceIndex=index<27?index:index-27;
          const destination=window.slots.findIndex(v=>v===null);if(source[sourceIndex]&&destination>=0){window.slots[destination]=source[sourceIndex];source[sourceIndex]=null;}}
        else if(window.slots[slot]){const destination=window.inventory.findIndex(v=>v===null);if(destination>=0){window.inventory[destination]=window.slots[slot];window.slots[slot]=null;}}
        trade.revision++;});
    },180);
  }
  cancelTrade(id:string){this.getBot(this.snapshot,id);this.nextGeneration(id);this.update(s=>{const t=s.trades[id];if(t){t.status='CLOSED';t.window=null;t.revision++;}});}
  simulateTradeTimeout(id:string){const t=this.getTradeState(id);if(t.status!=='WAITING_FOR_GUI')throw Error('GUI待機中のみtimeoutを試せます');
    this.nextGeneration(id);this.update(s=>{const trade=s.trades[id];trade.status='TIMEOUT';trade.error='Trade GUI timeout';trade.window=null;trade.revision++;});}
  invalidateTrade(id:string){const t=this.getTradeState(id);if(['REQUESTING','WAITING_FOR_GUI','OPEN'].includes(t.status))this.cancelTrade(id);}
  getSnapshot = ():Snapshot => this.snapshot;
  subscribe = (listener:()=>void):(()=>void) => { this.listeners.add(listener);return ()=>this.listeners.delete(listener); };
  private update(mutate:(draft:Snapshot)=>void) {
    const draft:Snapshot = structuredClone(this.snapshot);mutate(draft);
    draft.revision++;this.snapshot=draft;this.listeners.forEach(fn=>fn());
  }
  private log(s:Snapshot,message:string,level:'INFO'|'WARN'|'ERROR'='INFO',meta:Partial<Snapshot['logs'][number]>={}) {
    s.logs = [{id:++this.sequence,at:Date.now(),level,message,...meta},...s.logs].slice(0,120);
  }
  private getBot(s:Snapshot,id:string) {const b=s.bots.find(x=>x.id===id);if(!b)throw Error('Bot が見つかりません');return b;}
  private leave(s:Snapshot,b:Bot) {
    if (b.jobId) {const job=s.jobs.find(j=>j.id===b.jobId);if(job && ['ASSIGNED','RUNNING'].includes(job.state)) {job.state='QUEUED';job.botId=undefined;}}
    b.jobId=undefined;b.instanceId=undefined;
  }
  startBot(id:string) {this.update(s=>{const b=this.getBot(s,id);if(!['DISCONNECTED','LOBBY','RECOVERING'].includes(b.state))return;
    b.state=b.state==='DISCONNECTED'?'CONNECTING':'JOINING_PIT';b.updatedAt=Date.now();this.log(s,`${b.name} の起動をシミュレート`, 'INFO',{botId:id});});}
  stopBot(id:string) {this.invalidateTrade(id);this.update(s=>{const b=this.getBot(s,id);if(b.state==='DISCONNECTED')return;this.leave(s,b);b.state='DISCONNECTED';b.updatedAt=Date.now();this.log(s,`${b.name} を停止`, 'INFO',{botId:id});});}
  recoverBot(id:string) {this.invalidateTrade(id);this.update(s=>{const b=this.getBot(s,id);if(b.state==='DISCONNECTED')return;this.leave(s,b);b.state='RECOVERING';b.updatedAt=Date.now();this.log(s,`${b.name} を復旧状態に変更`, 'WARN',{botId:id});});}
  setBotState(id:string,state:BotState) {if(!availableStates.has(state))return;
    if(['DISCONNECTED','CONNECTING','LOBBY','JOINING_PIT','RECOVERING'].includes(state))this.invalidateTrade(id);
    this.update(s=>{const b=this.getBot(s,id);if(['DISCONNECTED','CONNECTING','LOBBY','JOINING_PIT','RECOVERING'].includes(state))this.leave(s,b);
      if(['IN_PIT_IDLE','PATHFINDING','WORKING'].includes(state) && !b.instanceId)b.instanceId=s.instances.find(i=>i.status==='ACTIVE')?.id;
      b.state=state;b.updatedAt=Date.now();this.log(s,`${b.name} → ${state}`,'INFO',{botId:id,instanceId:b.instanceId});});}
  createBots(count:number) {if(!Number.isInteger(count)||count<1||count>20)throw Error('1〜20体を指定してください');
    this.update(s=>{const previous=s.bots.length;const actual=Math.min(count,s.settings.maxBots);for(let i=previous;i<actual;i++){
      const id=`bot-${String(i+1).padStart(2,'0')}`,accountId=`acc-${String(i+1).padStart(2,'0')}`;
      if(!s.accounts.some(a=>a.id===accountId))s.accounts.push({id:accountId,label:`Mock ${String(i+1).padStart(2,'0')}`,kind:'SESSION',status:'READY',createdAt:Date.now()});
      const state:BotState=['IN_PIT_IDLE','LOBBY','RECOVERING','DISCONNECTED','CONNECTING','JOINING_PIT'][i%6] as BotState;
      s.bots.push({id,accountId,name:`Scout-${String(i+1).padStart(2,'0')}`,state,instanceId:state==='IN_PIT_IDLE'?s.instances.filter(v=>v.status==='ACTIVE')[i%2]?.id:undefined,x:i*13-20,y:64,z:i*-17,updatedAt:Date.now()});
    }this.log(s,`${Math.max(0,actual-previous)} Botを追加（合計 ${s.bots.length} / 20）`);});}
  addInstance(){this.update(s=>{const id=`pit-${String(++this.sequence).padStart(3,'0')}`;
    s.instances.push({id,status:'ACTIVE',firstSeen:Date.now(),lastSeen:Date.now(),metadata:'新規観測のMock'});
    this.log(s,`新しい Instance ${id} を観測`,'INFO',{instanceId:id});});}
  setInstanceStatus(id:string,status:InstanceStatus){this.update(s=>{const r=s.instances.find(x=>x.id===id);if(!r)return;
    r.status=status;r.lastSeen=Date.now();this.log(s,`${id} → ${status}`,'INFO',{instanceId:id});});}
  addAccount(label:string,kind:AccountKind){const clean=label.trim();if(!clean||clean.length>40)throw Error('名前を1〜40文字で入力してください');
    this.update(s=>{if(s.accounts.some(a=>a.label.toLowerCase()===clean.toLowerCase()))throw Error('同じ名前のAccountがあります');
      const id=`acc-new-${++this.sequence}`;s.accounts.push({id,label:clean,kind,status:'UNASSIGNED',createdAt:Date.now()});this.log(s,`Account ${clean} を追加`);});}
  createJob(instanceId:string){this.update(s=>{const instance=s.instances.find(x=>x.id===instanceId);if(!instance)throw Error('Instance が見つかりません');
    const id=`job-${++this.sequence}`;s.jobs.unshift({id,eventType:'Mock Event',instanceId,state:'QUEUED',x:32,y:64,z:-64,expiresAt:Date.now()+600000});
    this.log(s,`Mock Job ${id} を作成`,'INFO',{instanceId,jobId:id});});}
  setJobState(id:string,state:JobStatus){this.update(s=>{const j=s.jobs.find(x=>x.id===id);if(!j)return;
    if(['QUEUED','COMPLETED','FAILED','EXPIRED'].includes(state)){const b=s.bots.find(x=>x.jobId===id);if(b){b.jobId=undefined;if(['PATHFINDING','WORKING'].includes(b.state))b.state='IN_PIT_IDLE';}j.botId=undefined;}
    if(['ASSIGNED','RUNNING'].includes(state) && !j.botId){const b=s.bots.find(x=>x.instanceId===j.instanceId && x.state==='IN_PIT_IDLE'&&!x.jobId);if(b){j.botId=b.id;b.jobId=j.id;b.state=state==='RUNNING'?'WORKING':'PATHFINDING';}else{this.log(s,`割当可能な Bot がいません`,'WARN',{jobId:id});return;}}
    if(j.botId){const b=s.bots.find(x=>x.id===j.botId);if(b)b.state=state==='RUNNING'?'WORKING':'PATHFINDING';}
    j.state=state;this.log(s,`${id} → ${state}`,'INFO',{jobId:id,botId:j.botId});});}
  updateSettings(next:Partial<Settings>){this.update(s=>{if(next.maxBots!==undefined){if(next.maxBots<1||next.maxBots>20||next.maxBots<s.bots.length)throw Error('Bot上限は現在の体数〜20を指定してください');}
    if(next.pathConcurrency!==undefined&&(next.pathConcurrency<1||next.pathConcurrency>20))throw Error('探索数は1〜20です');
    if(next.eventPollingSeconds!==undefined&&(next.eventPollingSeconds<1||next.eventPollingSeconds>3600))throw Error('間隔は1〜3600秒です');
    s.settings={...s.settings,...next,javaVersion:'1.8.9'};this.log(s,'Mock 設定を変更');});}
  reset(){this.sequence=100;for(const id of this.tradeGeneration.keys())this.nextGeneration(id);this.snapshot=initial();this.listeners.forEach(fn=>fn());}
}
