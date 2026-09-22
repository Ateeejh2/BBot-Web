import { useEffect, useState, useSyncExternalStore } from 'react';
import { Activity, AlertTriangle, ArrowRight, Bot as BotIcon, Check, ChevronDown, ChevronRight, CircleHelp, Database, LayoutDashboard, Layers3, ListChecks, MoreHorizontal, Package, Play, Plus, Power, Radio, RotateCcw, ScrollText, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { bbotClient as client } from './client';
import { ServerConnectionPanel } from './ServerConnectionPanel';
import { LiveViewModal } from './LiveViewModal';
import { RemoteAccountsPanel } from './RemoteAccountsPanel';
import { botStates, validMinecraftUsername, type AccountKind, type Bot, type BotState, type ChatLogEntry, type ForgeWorker, type InstanceStatus, type JobStatus, type LogEntry, type PartyCommandResult, type Snapshot, type TradeItem, type TradeState } from './client/types';
type Page = 'dashboard'|'bots'|'instances'|'jobs'|'accounts'|'settings'|'logs'|'chat-debug';
const nav:{id:Page;label:string;icon:typeof LayoutDashboard}[] = [
  {id:'dashboard',label:'Overview',icon:LayoutDashboard},{id:'bots',label:'Bots',icon:BotIcon},
  {id:'instances',label:'Instances',icon:Layers3},{id:'jobs',label:'Jobs',icon:ListChecks},
  {id:'accounts',label:'Accounts',icon:Users},{id:'settings',label:'Settings',icon:Settings2},
  {id:'logs',label:'Logs',icon:ScrollText},{id:'chat-debug',label:'Chat Debug',icon:Radio}
];
const short:Record<BotState,string> = {DISCONNECTED:'Offline',CONNECTING:'Connecting',LOBBY:'Lobby',JOINING_PIT:'Joining Pit',IN_PIT_IDLE:'Idle',PREPARING_EVENT:'Preparing Event',PATHFINDING:'Pathfinding',WORKING:'Working',RECOVERING:'Recovering'};
const tone=(s:string)=> ['IN_PIT_IDLE','ACTIVE','READY','COMPLETED','DROPPED','CHEST_DETECTED'].includes(s)?'good':['PREPARING_EVENT','PATHFINDING','WORKING','RUNNING','ASSIGNED','STARTED','CARRIER_DETECTED','LAUNCHING'].includes(s)?'teal':['SUSPECT','RECOVERING','CONNECTING','JOINING_PIT','QUEUED','ARMED'].includes(s)?'amber':['FAILED','EXPIRED','LAUNCH_FAILED'].includes(s)?'red':'quiet';
const rel=(time:number)=>{const m=Math.max(0,Math.floor((Date.now()-time)/60000));return m<1?'たった今':m<60?`${m}分前`:m<1440?`${Math.floor(m/60)}時間前`:`${Math.floor(m/1440)}日前`};
const retryText=(retryAt?:number)=>retryAt===undefined?'—':retryAt<=Date.now()?'Ready':`${Math.max(1,Math.ceil((retryAt-Date.now())/1000))}s`;
const eventCountdown=(timestamp:number)=>{const seconds=Math.max(0,Math.ceil((timestamp-Date.now())/1000));if(seconds<60)return `${seconds}s`;const minutes=Math.floor(seconds/60);if(minutes<60)return `${minutes}m ${seconds%60}s`;const hours=Math.floor(minutes/60);return `${hours}h ${minutes%60}m`};
const eventClock=(timestamp:number)=>new Date(timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
function Badge({status,label}:{status:string;label?:string}){return <span className={`badge ${tone(status)}`}><span className="badge-dot" aria-hidden="true" />{label??status}</span>}
function Empty({title,detail}:{title:string;detail:string}){return <div className="empty"><Database size={26}/><strong>{title}</strong><p>{detail}</p></div>}
function SectionHead({kicker,title,action}:{kicker?:string;title:string;action?:React.ReactNode}){return <div className="section-head"><div>{kicker&&<span className="eyebrow">{kicker}</span>}<h2>{title}</h2></div>{action}</div>}
function TradePanel({bot,trade,onAction}:{bot:Bot;trade:TradeState;onAction:(task:()=>void)=>void}){
  const [expanded,setExpanded]=useState(false),[partyOpen,setPartyOpen]=useState(false),[partyUsername,setPartyUsername]=useState(''),[notice,setNotice]=useState(''),[noticeError,setNoticeError]=useState(false),[partyPending,setPartyPending]=useState(false);
  const [username,setUsername]=useState(''),[selected,setSelected]=useState<TradeItem|null>(null),[pending,setPending]=useState(false);
  const busy=['REQUESTING','WAITING_FOR_GUI','OPEN'].includes(trade.status),window=trade.window;
  useEffect(()=>setPending(false),[trade.revision]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3700);return()=>clearTimeout(timer)},[notice]);
  const runParty=async(action:()=>PartyCommandResult|Promise<PartyCommandResult>)=>{if(partyPending)return;setPartyPending(true);try{const result=await action();setNotice(result.serverMessage??result.message);setNoticeError(result.status==='REJECTED');if(result.status==='SENT')setPartyOpen(false);}catch(err){setNotice(err instanceof Error?err.message:'操作に失敗しました');setNoticeError(true);}finally{setPartyPending(false)}};
  const grid=(label:string,items:(TradeItem|null)[],offset:number)=>
    <section className="trade-section"><h4>{label}</h4><div className="trade-grid">{items.map((item,index)=><button key={index} className="trade-slot" aria-label={`${label} slot ${index+1}${item?`: ${item.name} x${item.count}`:''}`} disabled={pending||trade.status!=='OPEN'} onClick={()=>{if(item)setSelected(item);if(!item)return;setPending(true);try{client.clickTradeSlot(bot.id,{tradeSessionId:trade.tradeSessionId!,windowId:window!.windowId,slot:offset+index,revision:trade.revision});}catch{setPending(false);}}}>{item&&<><span className="trade-icon">{item.icon??'▣'}</span><span className="trade-item-name">{item.name}</span><small>x{item.count}</small></>}</button>)}</div></section>;
  return <div className="trade-panel"><div className="bot-command-actions"><button className="mini trade-toggle" aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);setPartyOpen(false)}}>Trade</button><button className="mini" aria-expanded={partyOpen} onClick={()=>{setPartyOpen(!partyOpen);setExpanded(false)}}>Party</button><button className="mini" disabled={partyPending} onClick={()=>runParty(()=>client.warpParty(bot.id))}>Warp</button></div>
    {notice&&<p className={noticeError?'trade-error':'trade-notice'} role={noticeError?'alert':'status'}>{notice}</p>}
    {partyOpen&&<div className="trade-content"><strong>Party</strong><label className="field-label" htmlFor={`party-${bot.id}`}>Minecraft ID</label><input id={`party-${bot.id}`} value={partyUsername} maxLength={16} autoComplete="off" spellCheck={false} onChange={e=>setPartyUsername(e.target.value)} placeholder="ExamplePlayer"/>
      {partyUsername&&!validMinecraftUsername(partyUsername)&&<small className="trade-error">1〜16文字の英数字と _ を入力してください</small>}
      <div className="trade-actions"><button className="button accent" disabled={partyPending||!validMinecraftUsername(partyUsername)} onClick={()=>runParty(()=>client.inviteParty(bot.id,partyUsername))}>Send Party</button><button className="button outline" onClick={()=>{setPartyOpen(false);setPartyUsername('')}}>Cancel</button></div></div>}
    {expanded&&<div className="trade-content"><strong>Target Player</strong>
      {!busy&&<><label className="field-label" htmlFor={`trade-${bot.id}`}>Minecraft username</label><input id={`trade-${bot.id}`} value={username} maxLength={16} autoComplete="off" spellCheck={false} onChange={e=>setUsername(e.target.value)} placeholder="PlayerName"/>
        {username&&!validMinecraftUsername(username)&&<small className="trade-error">1〜16文字の英数字と _ を入力してください</small>}
        <div className="trade-actions"><button className="button accent" disabled={!validMinecraftUsername(username)} onClick={()=>onAction(()=>client.startTrade(bot.id,username))}>Send Trade</button><button className="button outline" onClick={()=>{setExpanded(false);setUsername('')}}>Cancel</button></div></>}
      {trade.targetUsername&&trade.status!=='IDLE'&&<p>Trading with: <b>{trade.targetUsername}</b></p>}
      {trade.status==='WAITING_FOR_GUI'&&<p role="status">Waiting for Trade GUI...</p>}
      {trade.status==='TIMEOUT'&&<p role="alert" className="trade-error">Error: Trade GUI timeout</p>}
      {trade.status==='ERROR'&&<p role="alert" className="trade-error">Error: {trade.error??'Trade failed'}</p>}
      {['CLOSED','COMPLETED'].includes(trade.status)&&<p role="status">Trade {trade.status.toLowerCase()}</p>}
      {busy&&<div className="trade-actions"><button className="button outline" onClick={()=>onAction(()=>client.cancelTrade(bot.id))}>Cancel Trade</button>{client.mode==='mock'&&trade.status==='WAITING_FOR_GUI'&&<button className="button outline" onClick={()=>onAction(()=>client.simulateTradeTimeout(bot.id))}>Simulate Timeout</button>}</div>}
      {window&&trade.status==='OPEN'&&<div className="trade-window"><p className="mono">{window.title} · revision {trade.revision}</p>{grid('Trade Window',window.slots,0)}{grid('Inventory',window.inventory,window.slotCount)}{grid('Hotbar',window.hotbar,window.slotCount+27)}{selected&&<div className="trade-item-detail"><b>{selected.name} x{selected.count}</b>{selected.lore?.map((line,i)=><span key={i}>{line}</span>)}{selected.enchantments?.map((line,i)=><span key={i}>{line}</span>)}{selected.durability!==undefined&&<span>Durability: {selected.durability}</span>}{selected.metadata!==undefined&&<span>Metadata: {selected.metadata}</span>}<button onClick={()=>setSelected(null)}>Close</button></div>}</div>}
    </div>}
  </div>;
}
function BotCard({bot,compact,onAction,trade,onLiveView,transport,worker}:{bot:Bot;compact?:boolean;onAction:(task:()=>void|Promise<void>)=>void;trade?:TradeState;onLiveView?:(bot:Bot)=>void;transport?:'mineflayer'|'forge';worker?:ForgeWorker}){
  const active=bot.state!=='DISCONNECTED'||Boolean(bot.startQueued);
  const forge=client.mode==='remote'&&transport==='forge';
  const workerPhase=worker?.phase??'STOPPED';
  const launched=workerPhase==='LAUNCHED';
  const serverDisconnectable=!['DISCONNECTED','CONNECTING'].includes(bot.state);
  const showSecondary=!compact&&(client.mode==='mock'&&active||client.mode==='remote'&&bot.state==='IN_PIT_IDLE'||client.mode==='remote'&&!['DISCONNECTED','CONNECTING'].includes(bot.state)||Boolean(onLiveView));
  const progressLabel=workerPhase==='LAUNCHING'
    ?`Launching Forge... ${Math.max(0,Math.min(100,Math.round(worker?.launchProgress??0)))}%`
    :bot.activity?.kind==='SCANNING_CHUNKS'
      ?`scanning chunk... ${Math.max(0,Math.min(100,Math.round(bot.activity.progress)))}%`
      :undefined;
  const badgeStatus=workerPhase==='LAUNCHING'?'CONNECTING':bot.activity?.kind==='SCANNING_CHUNKS'?'PATHFINDING':bot.state;
  const moderation=bot.moderation??(bot.kickReason?{
    kind:'KICK' as const,reason:bot.kickReason,detectedAt:bot.kickedAt??bot.updatedAt,persistent:false
  }:undefined);
  return <article className={`bot-card ${compact?'compact':''}`}>
    <div className="bot-main"><div className={`bot-avatar ${tone(bot.state)}`}><BotIcon size={21} strokeWidth={1.8}/></div>
      <div className="bot-identity"><strong>{bot.name}</strong><span className="mono faint">{bot.id} · {bot.instanceId??'No instance'}{forge?` · Forge ${workerPhase}`:''}</span></div>
      <Badge status={badgeStatus} label={progressLabel??(bot.startQueued?'Queued':short[bot.state])}/></div>
    {moderation&&<div className={`bot-kick ${moderation.kind==='BAN'?'ban':''} ${compact?'compact-kick':''}`} role={moderation.kind==='BAN'||bot.state==='DISCONNECTED'?'alert':'status'}>
      <AlertTriangle size={15}/><div>
        <strong>{moderation.kind==='BAN'?'BAN detected':'KICK detected'}{moderation.detectedAt!==undefined?` · ${rel(moderation.detectedAt)}`:''}</strong>
        <span>{moderation.reason}</span>
        {moderation.kind==='BAN'&&<small>Saved on this account · remains visible after Quit / Backend restart</small>}
      </div>
    </div>}
    {!compact&&<div className="bot-details"><span>Position <b className="mono">{bot.state!=='DISCONNECTED'?`${bot.x.toFixed(1)} / ${bot.y.toFixed(1)} / ${bot.z.toFixed(1)}`:'—'}</b></span><span>Job <b className="mono">{bot.jobId??'—'}</b></span></div>}
    <div className="card-actions lifecycle-actions">
      {forge?<><button className="mini" disabled={workerPhase!=='STOPPED'} onClick={()=>onAction(()=>client.launchForge!(bot.id))}><Power size={15}/> {workerPhase==='LAUNCHING'?'Launching...':'Launch'}</button>
        <button className="mini" disabled={!launched} onClick={()=>onAction(()=>client.quitForge!(bot.id))}><X size={15}/> Quit</button>
        <button className="mini primary-mini" disabled={!launched||active} onClick={()=>onAction(()=>client.startBot(bot.id))}><Play size={15}/> Start</button>
        <button className="mini" disabled={!launched||!serverDisconnectable} onClick={()=>onAction(()=>client.stopBot(bot.id))}><Power size={15}/> Disconnect</button></>
        :!active?<button className="mini primary-mini" onClick={()=>onAction(()=>client.startBot(bot.id))}><Play size={15}/> Start</button>:<button className="mini" onClick={()=>onAction(()=>client.stopBot(bot.id))}><Power size={15}/> Stop</button>}
    </div>
    {showSecondary&&<div className="card-actions secondary-actions">
      {client.mode==='mock'&&active&&<button className="mini" onClick={()=>onAction(()=>client.recoverBot(bot.id))}><RotateCcw size={15}/> Recover</button>}
      {client.mode==='remote'&&bot.state==='IN_PIT_IDLE'&&<button className="mini launch-test-button" onClick={()=>onAction(()=>client.testLaunchPad!(bot.id))}><ArrowRight size={15}/> Test Launch Pad</button>}
      {client.mode==='remote'&&bot.state==='IN_PIT_IDLE'&&<button className="mini" onClick={()=>onAction(()=>client.testCarePackage!(bot.id))}><Package size={15}/> Test Care Package</button>}
      {client.mode==='remote'&&!['DISCONNECTED','CONNECTING'].includes(bot.state)&&<button className="mini" onClick={()=>onAction(()=>client.oofBot!(bot.id))}><X size={15}/> OOF</button>}
      {!compact&&<button className="mini live-view-button" disabled={!active} onClick={()=>onLiveView?.(bot)}><Radio size={15}/> Live View</button>}
      {!compact&&client.mode==='mock'&&<label className="select-wrap"><span className="sr-only">{bot.name} の状態</span><select value={bot.state} onChange={e=>onAction(()=>client.setBotState(bot.id,e.target.value as BotState))} aria-label={`${bot.name} の状態を試す`}>
        {botStates.map(s=><option key={s} value={s}>{s}</option>)}</select><ChevronDown size={13}/></label>}
    </div>}
    {!compact&&trade&&client.mode==='mock'&&<TradePanel bot={bot} trade={trade} onAction={onAction}/>}
  </article>
}
function InstanceCard({id,status,count,lastSeen,onAction}:{id:string;status:InstanceStatus;count:number;lastSeen:number;onAction:(task:()=>void)=>void}){
  return <article className="instance-card"><div className="instance-top"><div className="instance-icon"><Layers3 size={19}/></div><Badge status={status}/></div>
    <h3 className="mono">{id}</h3><p className="muted">{count} bots assigned <span className="bullet">·</span> seen {rel(lastSeen)}</p>
    {client.mode==='mock'&&<div className="instance-actions"><button className="text-button" onClick={()=>onAction(()=>client.setInstanceStatus(id,status==='ACTIVE'?'SUSPECT':'ACTIVE'))}>Mark {status==='ACTIVE'?'suspect':'active'} <ArrowRight size={14}/></button></div>}</article>
}
function NavButton({id,label,icon:Icon,page,setPage}:{id:Page;label:string;icon:typeof LayoutDashboard;page:Page;setPage:(v:Page)=>void}){
  return <button type="button" className={`nav-button ${page===id?'selected':''}`} onClick={()=>setPage(id)} aria-current={page===id?'page':undefined}><Icon size={19} strokeWidth={1.9}/><span>{label}</span></button>
}
function App(){
  const snapshot=useSyncExternalStore(client.subscribe,client.getSnapshot,client.getSnapshot);
  const [page,setPage]=useState<Page>('dashboard'),[more,setMore]=useState(false),[toast,setToast]=useState('');
  const [filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[accountOpen,setAccountOpen]=useState(false);
  const [accountKind,setAccountKind]=useState<AccountKind>('SESSION'),[accountLabel,setAccountLabel]=useState('');
  const [jobInstance,setJobInstance]=useState('mega10c');
  const [jobType,setJobType]=useState('manual.event'),[jobX,setJobX]=useState('0'),[jobY,setJobY]=useState('64'),[jobZ,setJobZ]=useState('0'),[jobTtl,setJobTtl]=useState('300');
  const [liveBotId,setLiveBotId]=useState<string|null>(null);
  useEffect(()=>{if(!more&&!accountOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMore(false);setAccountOpen(false)}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[more,accountOpen]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3700);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{if(client.mode==='remote'&&snapshot.instances.length&&!snapshot.instances.some(i=>i.id===jobInstance))setJobInstance(snapshot.instances[0]!.id)},[snapshot.instances,jobInstance]);
  const jobNumbers=[jobX,jobY,jobZ].map(value=>value.trim()===''?NaN:Number(value)),jobTtlSeconds=Number(jobTtl);
  const remoteJobValid=snapshot.instances.some(i=>i.id===jobInstance)&&/^[A-Za-z0-9_.:-]{1,64}$/.test(jobType)&&
    jobNumbers.every(n=>Number.isFinite(n)&&Math.abs(n)<=30_000_000)&&/^\d+$/.test(jobTtl)&&jobTtlSeconds>=5&&jobTtlSeconds<=3600;
  const go=(v:Page)=>{setPage(v);setMore(false);setFilter('all');setQuery('');window.scrollTo({top:0,behavior:'smooth'});};
  const perform=(task:()=>void|Promise<void>,success='操作を送信しました')=>{void Promise.resolve().then(task).then(()=>setToast(success)).catch(err=>setToast(err instanceof Error?err.message:'操作に失敗しました'))};
  const active=snapshot.bots.filter(b=>b.state!=='DISCONNECTED').length;
  const forgeMode=client.mode==='remote'&&snapshot.transport==='forge';
  const assignedReadyOffline=snapshot.bots.filter(b=>b.state==='DISCONNECTED'&&!b.startQueued&&snapshot.accounts.some(a=>a.assignedBot===b.id&&a.status==='READY')).length;
  const live=snapshot.bots.filter(b=>['IN_PIT_IDLE','PREPARING_EVENT','PATHFINDING','WORKING'].includes(b.state)).length;
  const pending=snapshot.jobs.filter(j=>['QUEUED','ASSIGNED','RUNNING'].includes(j.state)).length;
  const movementDebugLocked=snapshot.bots.some(b=>b.state!=='DISCONNECTED'||Boolean(b.startQueued));
  const current=nav.find(n=>n.id===page)!;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">B<span>.</span></span><div><strong>BBot</strong><small>CONTROL ROOM</small></div></div>
      <div className="sidebar-label">WORKSPACE</div><nav className="side-nav" aria-label="メインナビゲーション">{nav.map(n=><NavButton key={n.id} {...n} page={page} setPage={go}/>)}</nav>
      <div className="sidebar-bottom"><div className="connector"><span className="signal-ring"><Radio size={16}/></span><div><b>{client.mode==='remote'?'Remote BBot':'Mock environment'}</b><small>{client.mode==='remote'?(snapshot.remoteConnected?'実Botと同期中':'backendとの接続待ち'):'BBot本体には未接続'}</small></div></div><div className="build-meta">BBOT CONSOLE <span>v0.1 · JAVA 1.8.9</span></div></div>
    </aside>
    <div className="mobile-top"><div className="mobile-brand"><span className="brand-mark">B<span>.</span></span><b>BBot</b></div><span className="mobile-mode"><span className="mode-dot"/> {client.mode==='remote'?'REMOTE MODE':'MOCK MODE'}</span></div>
    <main className="content" id="main"><div className="desktop-top"><div className="breadcrumb">WORKSPACE <ChevronRight size={14}/> {current.label.toUpperCase()}</div><div className="top-right"><span className="version-pill">JAVA EDITION <b>1.8.9</b></span><span className="mode-pill"><span className="mode-dot"/> {client.mode==='remote'?'REMOTE MODE':'MOCK MODE'}</span></div></div>
      <div className="page-head"><div><div className="eyebrow">BBOT / {current.label.toUpperCase()}</div><h1>{page==='dashboard'?'Command center':current.label}</h1><p>{({dashboard:client.mode==='remote'?'実Bot backendを操作・監視する管理画面。':'20クライアントまでを見渡す、Mockの管理画面。',bots:'各Botの状態と操作をまとめて確認。',instances:'発見したPit instanceの状態を確認。',jobs:'イベントの割当と進行状況を確認。',accounts:client.mode==='remote'?'Microsoft / Session Accountの追加・削除とBot割当。Forge Launchもここで割り当てたAccountを使用します。':'Session Accountの表示と追加を試す。',settings:client.mode==='remote'?'Minecraft接続先と実Bot動作の設定。':'Mock環境の表示設定と動作値。',logs:client.mode==='remote'?'実Botの操作履歴。':'Mock操作の履歴。秘密情報は記録しません。','chat-debug':client.mode==='remote'?'Minecraftから受信したチャット / systemメッセージをBot別に確認。':'Mockの受信チャット表示。'} as Record<Page,string>)[page]}</p></div>
        {page==='bots'&&client.mode==='mock'&&<button className="button accent" disabled={snapshot.bots.length>=20} onClick={()=>perform(()=>{client.updateSettings({maxBots:20});client.createBots(20)},'20 BotのMock状態を生成しました')}><Plus size={17}/> Generate 20 Bots</button>}
        {page==='bots'&&client.mode==='remote'&&!forgeMode&&<div className="server-actions">
          <button className="button accent" disabled={assignedReadyOffline===0} onClick={()=>perform(async()=>{await client.startAssignedBots!()},`割当済み ${assignedReadyOffline} BotのStartを予約しました`)}><Play size={17}/> Start Assigned</button>
          <button className="button outline" disabled={active===0&&!snapshot.bots.some(b=>b.startQueued)} onClick={()=>perform(async()=>{await client.stopAllBots!()},'全Botを停止しました')}><Power size={17}/> Stop All</button>
        </div>}
        {page==='instances'&&client.mode==='mock'&&<button className="button accent" onClick={()=>perform(()=>client.addInstance(),'新しいInstanceを観測しました')}><Plus size={17}/> Add instance</button>}
        {page==='accounts'&&client.mode==='mock'&&<button className="button accent" onClick={()=>setAccountOpen(true)}><Plus size={17}/> Add account</button>}
      </div>
      {client.mode==='remote'&&!snapshot.remoteConnected&&<div className="insight" role="status"><Radio size={18}/><p>backendとの接続待ちです。API_ORIGINとWebSocketプロキシを確認してください。</p></div>}
      {client.mode==='remote'&&forgeMode&&page==='bots'&&<div className="insight"><CircleHelp size={18}/><p>LaunchでForge clientを起動します。StartはSettingsのServer Connectionへ接続し、spawn確認後5秒待って /play pit を送り、instance確定後にIdleになります。DisconnectはMinecraft serverだけ切断し、QuitはForge clientを終了します。</p></div>}
      {client.mode==='remote'&&page==='jobs'&&<div className="insight"><CircleHelp size={18}/><p>Job投入後、同じinstanceのIdle Botが自動で割り当てられ、Pathfindingを開始します。最初は近い安全な座標で確認してください。</p></div>}
      {page==='dashboard'&&<Dashboard data={snapshot} active={active} live={live} pending={pending} go={go} perform={perform}/>}
      {page==='bots'&&<section className="view-section"><div className="toolbar"><div className="filter-row" role="group" aria-label="Bot絞り込み">{[['all','All'],['active','Active'],['idle','Idle'],['offline','Offline']].map(([v,l])=><button key={v} className={`filter ${filter===v?'is-active':''}`} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bot / Instance を検索" aria-label="Bot検索"/></div></div>
        <div className="list-label">FLEET <span>{snapshot.bots.length} / {snapshot.settings.maxBots} BOTS</span></div>
        <div className="bot-grid">{snapshot.bots.filter(b=>(filter==='all'||filter==='active'&&(b.state!=='DISCONNECTED'||Boolean(b.startQueued))||filter==='offline'&&b.state==='DISCONNECTED'&&!b.startQueued||filter==='idle'&&b.state==='IN_PIT_IDLE')&&(b.name.toLowerCase().includes(query.toLowerCase())||b.id.includes(query.toLowerCase())||b.instanceId?.includes(query.toLowerCase()))).map(b=><BotCard key={b.id} bot={b} transport={snapshot.transport} worker={snapshot.forgeWorkers?.find(worker=>worker.botId===b.id)} trade={snapshot.trades[b.id]??client.getTradeState(b.id)} onAction={perform} onLiveView={bot=>setLiveBotId(bot.id)}/>)}</div>
        {!snapshot.bots.some(b=>(filter==='all'||filter==='active'&&(b.state!=='DISCONNECTED'||Boolean(b.startQueued))||filter==='offline'&&b.state==='DISCONNECTED'&&!b.startQueued||filter==='idle'&&b.state==='IN_PIT_IDLE')&&(b.name.toLowerCase().includes(query.toLowerCase())||b.instanceId?.includes(query.toLowerCase())))&&<Empty title="該当するBotがありません" detail="条件を変更して確認してください。"/>}</section>}
      {page==='instances'&&<section className="view-section"><div className="insight"><Activity size={18}/><p>Instance一覧は固定ではありません。Mockで追加・状態変更を試せます。確認済みの集合であり、総instance数ではありません。</p></div>
        <div className="list-label">OBSERVED INSTANCES <span>{snapshot.instances.length} FOUND</span></div><div className="instance-grid">{snapshot.instances.map(i=><InstanceCard key={i.id} id={i.id} status={i.status} count={snapshot.bots.filter(b=>b.instanceId===i.id).length} lastSeen={i.lastSeen} onAction={perform}/>)}</div></section>}
      {page==='jobs'&&<section className="view-section">
        {client.mode==='mock'?<div className="job-actions"><label>Mock event for <select value={jobInstance} onChange={e=>setJobInstance(e.target.value)}>{snapshot.instances.map(i=><option key={i.id} value={i.id}>{i.id}</option>)}</select></label><button className="button accent" onClick={()=>perform(()=>client.createJob(jobInstance),'Mock Jobを追加しました')}><Plus size={17}/> Create job</button></div>:
        <div className="panel job-create-panel"><SectionHead kicker="MANUAL JOB" title="Create job"/><div className="job-create-grid">
          <label>Instance<select value={jobInstance} onChange={e=>setJobInstance(e.target.value)} disabled={!snapshot.instances.length}>{snapshot.instances.length?snapshot.instances.map(i=><option key={i.id} value={i.id}>{i.id}</option>):<option value="">No observed instance</option>}</select></label>
          <label>Event type<input value={jobType} maxLength={64} onChange={e=>setJobType(e.target.value)} placeholder="manual.event" spellCheck={false}/></label>
          <label>X<input value={jobX} inputMode="decimal" onChange={e=>setJobX(e.target.value)}/></label>
          <label>Y<input value={jobY} inputMode="decimal" onChange={e=>setJobY(e.target.value)}/></label>
          <label>Z<input value={jobZ} inputMode="decimal" onChange={e=>setJobZ(e.target.value)}/></label>
          <label>TTL seconds<input value={jobTtl} inputMode="numeric" onChange={e=>setJobTtl(e.target.value)}/></label>
        </div><div className="server-actions"><button className="button accent" disabled={!remoteJobValid} onClick={()=>perform(async()=>{await client.submitJob!({instanceId:jobInstance,eventType:jobType,target:{x:jobNumbers[0]!,y:jobNumbers[1]!,z:jobNumbers[2]!},expiresAt:Date.now()+jobTtlSeconds*1000})},'Jobを投入しました')}><Plus size={17}/> Submit Job</button></div></div>}
        <div className="list-label">JOB QUEUE <span>{snapshot.jobs.length} TOTAL</span></div>
        {snapshot.jobs.length?<div className="job-list">{snapshot.jobs.map(j=><article className="job-card" key={j.id}><div className="job-header"><div className="job-icon"><ListChecks size={18}/></div><div className="job-title"><strong>{j.eventType}</strong><span className="mono faint">{j.id} · {j.instanceId}</span></div><Badge status={j.state}/></div><div className="job-foot"><span className="mono">{j.x} / {j.y} / {j.z}</span><span>{j.botId??'Unassigned'}</span></div>
          {client.mode==='mock'?<div className="job-state"><span>Mock status</span><label className="select-wrap"><select aria-label={`${j.id} の状態`} value={j.state} onChange={e=>perform(()=>client.setJobState(j.id,e.target.value as JobStatus))}>{(['QUEUED','ASSIGNED','RUNNING','COMPLETED','FAILED','EXPIRED'] as JobStatus[]).map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={13}/></label></div>:
          <><div className="job-state"><span>Expires</span><span className="mono">{new Date(j.expiresAt).toLocaleTimeString()}</span></div>
            <div className="job-diagnostics">
              <span>Attempts <strong>{j.attempts??0} / {j.maxAttempts??'—'}</strong></span>
              <span>Last failure <strong className="mono">{j.lastFailure??'—'}</strong></span>
              <span>Retry <strong>{j.state==='QUEUED'?retryText(j.retryAt):'—'}</strong></span>
            </div></>}</article>)}</div>:<Empty title="Jobはありません" detail={client.mode==='remote'?'観測済みinstanceへManual Jobを投入できます。':'Mock Jobを作成してください。'}/>}</section>}
      {page==='accounts'&&client.mode==='remote'&&<RemoteAccountsPanel snapshot={snapshot} notify={setToast}/>} 
      {page==='accounts'&&client.mode==='mock'&&<section className="view-section"><div className="insight"><ShieldCheck size={20}/><p>Session AccountはUIのみ。Mockではtokenを入力・保持せず、Bot本体への認証も行いません。</p></div><div className="list-label">ACCOUNTS <span>{snapshot.accounts.length} ADDED</span></div><div className="account-list">{snapshot.accounts.map(a=><div className="account-row" key={a.id}><div className="account-avatar">{a.label.slice(0,1).toUpperCase()}</div><div><strong>{a.label}</strong><span>{a.kind==='SESSION'?'Session Account':'Microsoft Account'} · {a.status==='UNASSIGNED'?'Unassigned':'Mock ready'}</span></div><span className="account-lock"><ShieldCheck size={16}/><span>No token</span></span></div>)}</div></section>}
      {page==='settings'&&client.mode==='remote'&&<section className="view-section settings-grid"><ServerConnectionPanel snapshot={snapshot} notify={setToast}/>{forgeMode&&<div className="panel"><div className="panel-icon"><Radio size={21}/></div><h2>Forge Worker</h2><p className="muted">BotsのStartは上のServer Connectionに保存されたhost / portを使います。LaunchはMinecraftへは接続せず、Forge clientだけを起動します。</p></div>}<div className="panel"><div className="panel-icon"><Settings2 size={21}/></div><h2>Movement Debug Mode</h2><p className="muted">ONでBotは接続後、最初のspawnから短いpathfindを繰り返します。/play pit、Job、Care Package処理は実行しません。</p>
        <div className="setting-row"><div><strong>Connect → Pathfind only</strong><small>{movementDebugLocked?'全BotをStopすると切り替えできます':'Anti-Cheat movement確認用'}</small></div><button role="switch" aria-checked={Boolean(snapshot.movementDebug)} aria-label="Movement Debug Mode" disabled={movementDebugLocked} onClick={()=>perform(()=>client.setMovementDebug!(!snapshot.movementDebug),`Movement Debug Modeを${snapshot.movementDebug?'OFF':'ON'}にしました`)} className={`toggle ${snapshot.movementDebug?'on':''}`}><span/></button></div>
        {snapshot.movementDebug&&<div className="insight" role="status"><Activity size={18}/><p>Debug Mode ON: Startすると接続 → first spawn → 約6 blocksずつpathfindを繰り返します。Stopするまで継続します。</p></div>}
      </div></section>}
      {page==='settings'&&client.mode==='mock'&&<section className="view-section settings-grid"><ServerConnectionPanel snapshot={snapshot} notify={setToast}/><div className="panel"><div className="panel-icon"><Settings2 size={21}/></div><h2>Mock configuration</h2><p className="muted">この画面だけの一時設定。再読み込みで初期状態に戻ります。</p>
        <SettingSelect label="Bot limit" value={snapshot.settings.maxBots} options={[6,10,15,20]} onChange={value=>perform(()=>client.updateSettings({maxBots:value}))}/>
        <SettingSelect label="Pathfinding concurrency" value={snapshot.settings.pathConcurrency} options={[1,2,3,4]} onChange={value=>perform(()=>client.updateSettings({pathConcurrency:value}))}/>
        <SettingSelect label="Event polling interval" value={snapshot.settings.eventPollingSeconds} options={[5,10,30,60]} suffix="s" onChange={value=>perform(()=>client.updateSettings({eventPollingSeconds:value}))}/>
        <div className="setting-row"><div><strong>Debug mode</strong><small>追加のMock診断表示</small></div><button role="switch" aria-checked={snapshot.settings.debug} aria-label="Debug mode" onClick={()=>perform(()=>client.updateSettings({debug:!snapshot.settings.debug}))} className={`toggle ${snapshot.settings.debug?'on':''}`}><span/></button></div>
      </div><div className="panel"><div className="panel-icon"><CircleHelp size={21}/></div><h2>Environment</h2><div className="about-line"><span>Data source</span><b>MockBBotClient</b></div><div className="about-line"><span>Minecraft</span><b>Java 1.8.9</b></div><div className="about-line"><span>Backend</span><b>Not connected</b></div><p className="muted note">本番用REST / WebSocketクライアントは未接続です。操作はMinecraft Botへ送信されません。</p><button className="button outline full" onClick={()=>{client.reset();setToast('Mock状態を初期化しました')}}><RotateCcw size={16}/> Reset mock data</button></div></section>}
      {page==='logs'&&<section className="view-section"><div className="list-label">ACTIVITY FEED <span>LATEST {snapshot.logs.length}</span></div><div className="log-list">{snapshot.logs.map((l:LogEntry)=><article className="log-row" key={l.id}><span className={`log-mark ${l.level.toLowerCase()}`}><Activity size={15}/></span><div><strong>{l.message}</strong><span className="mono faint">{[l.botId,l.instanceId,l.jobId].filter(Boolean).join(' / ')||'system'}</span></div><time>{rel(l.at)}</time></article>)}</div></section>}
      {page==='chat-debug'&&<section className="view-section"><div className="insight"><Radio size={18}/><p>受信したMinecraftチャット / systemメッセージ専用のDebug feedです。色コードは除去し、最新200件まで保持します。</p></div><div className="list-label">RECEIVED CHAT <span>LATEST {snapshot.chatLogs.length}</span></div>{snapshot.chatLogs.length?<div className="chat-debug-list">{[...snapshot.chatLogs].reverse().map((l:ChatLogEntry)=><article className="chat-debug-row" key={l.id}><div className="chat-debug-head"><div className="chat-debug-meta"><span className="mono">{l.botId}</span>{l.instanceId&&<span className="mono faint">{l.instanceId}</span>}<span className="chat-debug-channel">{l.channel}</span></div><time title={new Date(l.at).toLocaleString()}>{new Date(l.at).toLocaleTimeString()}</time></div><div className="chat-debug-text">{l.text}</div></article>)}</div>:<Empty title="受信チャットはまだありません" detail="BotがMinecraftからメッセージを受信するとここに表示されます。"/>}</section>}
      <footer className="footer">BBOT CONSOLE <span>{client.mode==='remote'?'LIVE':'MOCK'} · JAVA 1.8.9</span></footer>
    </main>
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">{nav.slice(0,4).map(n=><NavButton key={n.id} {...n} page={page} setPage={go}/>)}<button className={`nav-button ${['accounts','settings','logs','chat-debug'].includes(page)?'selected':''}`} aria-expanded={more} onClick={()=>setMore(true)}><MoreHorizontal size={20}/><span>More</span></button></nav>
    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="その他の画面" onClick={e=>e.stopPropagation()}><div className="sheet-head"><b>More</b><button className="icon-button" aria-label="閉じる" onClick={()=>setMore(false)}><X size={21}/></button></div>{nav.slice(4).map(n=><button className="sheet-item" key={n.id} onClick={()=>go(n.id)}><n.icon size={19}/>{n.label}<ChevronRight size={17}/></button>)}<div className="sheet-foot">{client.mode==='remote'?'REMOTE':'MOCK'} MODE · JAVA EDITION 1.8.9</div></div></div>}
    {accountOpen&&<div className="overlay" onClick={()=>setAccountOpen(false)}><div className="sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e=>e.stopPropagation()}><div className="sheet-head"><b id="account-title">Add account</b><button className="icon-button" aria-label="閉じる" onClick={()=>setAccountOpen(false)}><X size={21}/></button></div><div className="form-body"><div className="type-tabs" role="group" aria-label="Account方式"><button className={accountKind==='SESSION'?'chosen':''} onClick={()=>setAccountKind('SESSION')}>Session Account</button><button className={accountKind==='MICROSOFT'?'chosen':''} onClick={()=>setAccountKind('MICROSOFT')}>Microsoft</button></div><label className="field-label" htmlFor="account-label">Display label</label><input id="account-label" maxLength={40} value={accountLabel} onChange={e=>setAccountLabel(e.target.value)} placeholder="例: Scout 07" autoComplete="off"/><div className="token-note"><ShieldCheck size={19}/><span>Mockではtoken入力を行いません。秘密情報は保持・保存されません。</span></div><button className="button accent full" onClick={()=>{try{client.addAccount(accountLabel,accountKind);setAccountOpen(false);setAccountLabel('');setToast('Mock Accountを追加しました')}catch(err){setToast(err instanceof Error?err.message:'追加に失敗しました')}}}><Plus size={17}/> Add Mock account</button></div></div></div>}
    {liveBotId&&snapshot.bots.find(bot=>bot.id===liveBotId)&&<LiveViewModal bot={snapshot.bots.find(bot=>bot.id===liveBotId)!} remoteViewer={client.mode==='remote'?snapshot.viewer??null:undefined} onClose={()=>setLiveBotId(null)}/>}
    {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>
}
function CarePackagePanel({schedule,tracking}:{schedule:NonNullable<Snapshot['carePackages']>;tracking?:Snapshot['carePackageTracking']}){
  return <section className="panel care-package-panel"><SectionHead kicker="PIT EVENTS" title="Next Care Packages" action={<a className="link" href={schedule.sourceUrl} target="_blank" rel="noreferrer">brookeafk.com <ArrowRight size={15}/></a>}/>
    <div className="care-package-meta"><span className={`source-state ${schedule.status.toLowerCase()}`}>{schedule.status}</span><span>{schedule.updatedAt?`Updated ${rel(schedule.updatedAt)}`:'Waiting for first update'}</span></div>
    {schedule.events.length?<div className="care-package-list">{schedule.events.map((event,index)=><div className="care-package-row" key={event.timestamp}>
      <span className="care-package-icon"><Package size={17}/></span><span className="care-package-rank">#{index+1}</span><div><strong>Care Package</strong><small>{eventClock(event.timestamp)}</small></div><b className="care-package-countdown">{eventCountdown(event.timestamp)}</b>
    </div>)}</div>:<p className="care-package-empty">{schedule.status==='UNAVAILABLE'?'イベント情報を取得できていません。':'今後のCare Packageが見つかりません。'}</p>}
    {tracking?.timestamp&&<div className="care-tracking"><div className="care-tracking-head"><span>LIVE TRACKING</span><b>{eventClock(tracking.timestamp)}</b></div>
      {tracking.instances.length?tracking.instances.map(item=><div className="care-tracking-row" key={item.instanceId}><span className="mono">{item.instanceId}</span><Badge status={item.state}/><small>{item.target?`${item.target.x.toFixed(1)} / ${item.target.z.toFixed(1)}`:'waiting'}</small></div>):<small className="care-tracking-wait">Carrier/chest signalを待っています。</small>}
    </div>}
  </section>
}
function NetworkIdentityPanel({identity}:{identity:NonNullable<Snapshot['networkIdentity']>}){
  const current=identity.current,previous=identity.previous;
  const countryRegion=current?([current.country??current.countryCode,current.region].filter(Boolean).join(' · ')||'—'):'—';
  const previousCountryRegion=previous?([previous.country??previous.countryCode,previous.region].filter(Boolean).join(' · ')||'—'):'—';
  const level=identity.risk?.level??'Unknown',score=identity.risk?.score;
  const riskClass=level.toLowerCase();
  const ipChanged=identity.status==='OK'&&previous
    ?identity.ipChanged??identity.changes?.ip??(current?.ip!==undefined&&current.ip!==previous.ip)
    :undefined;
  const shortWindowHours=identity.recentChanges?Math.round(identity.recentChanges.windowMs/3_600_000):6;
  const comparison=identity.status==='CHECKING'
    ?'Checking backend network identity'
    :identity.status==='UNAVAILABLE'
      ?'Current backend lookup unavailable'
      :!previous
        ?'No previous baseline'
        :identity.changed
          ?'Changed since previous check'
          :'Matches previous check';
  const changes=[
    ['IP',identity.changes?.ip],
    ['ASN',identity.changes?.asn],
    ['Country',identity.changes?.country],
    ['Region',identity.changes?.region]
  ] as const;
  return <section className={`panel network-identity-panel risk-${riskClass}`}>
    <div className="network-identity-head">
      <div><span className="eyebrow">EGRESS NETWORK</span><h2>Connection network diagnostic</h2></div>
      <div className="network-risk">
        <span className={`network-risk-level ${riskClass}`}>
          {level==='Safe'?<ShieldCheck size={15}/>:level==='Unknown'?<CircleHelp size={15}/>:<AlertTriangle size={15}/>} {level}
        </span>
        <strong>{score===undefined?'—':score}<small>/100</small></strong>
      </div>
    </div>
    <div className="network-identity-grid">
      <div><span>Current Public IP</span><strong className="mono">{current?.ip??'—'}</strong><small>{current?.observedAt?'Observed '+rel(current.observedAt):'Waiting for backend lookup'}</small></div>
      <div><span>ASN</span><strong>{current?.asn?`AS${current.asn}`:'—'}</strong><small>{current?.organization??'Unknown organization'}</small></div>
      <div><span>Country / Region</span><strong>{countryRegion}</strong><small>{current?.city?`Approx. city: ${current.city}`:'IP geolocation is approximate'}</small></div>
      <div><span>Previous Public IP</span><strong className="mono">{previous?.ip??'—'}</strong><small>{previous?.observedAt?`${new Date(previous.observedAt).toLocaleString()} · ${previousCountryRegion}`:'No persisted baseline yet'}</small></div>
      <div><span>IP changed</span><strong>{ipChanged===undefined?'—':ipChanged?'Yes':'No'}</strong><small>{previous?'Compared with previous successful check':'Needs a previous successful check'}</small></div>
      <div><span>Last checked</span><strong>{identity.checkedAt?new Date(identity.checkedAt).toLocaleString():'—'}</strong><small>{identity.checkedAt?rel(identity.checkedAt):'No backend result yet'}</small></div>
      <div><span>Recent changes</span><strong>{identity.recentChanges?`${identity.recentChanges.ip} IP / ${identity.recentChanges.asn} ASN`:'—'}</strong><small>{identity.recentChanges?`Last ${shortWindowHours}h · region ${identity.recentChanges.region} · country ${identity.recentChanges.country}`:`Last ${shortWindowHours}h history unavailable`}</small></div>
      <div><span>Risk</span><strong>{level}</strong><small>{score===undefined?'Score unavailable':`BBot score ${score}/100`}</small></div>
    </div>
    <div className="network-comparison">
      <div className="network-comparison-head">
        <strong>{comparison}</strong>
        {identity.checkedAt&&<small>Last checked {rel(identity.checkedAt)}</small>}
      </div>
      {identity.changes
        ?<div className="network-change-tags">{changes.map(([label,changed])=><span key={label} className={changed?'changed':'same'}>{changed?<AlertTriangle size={12}/>:<Check size={12}/>} {label} {changed?'changed':'same'}</span>)}</div>
        :<span className="network-no-baseline">比較可能な前回データがありません。</span>}
    </div>
    <div className="network-risk-detail">
      <div><strong>Risk factors</strong><span>{identity.risk?.reasons?.join(' · ')??'Risk data unavailable'}</span></div>
      <small>BBot独自のネットワーク差分・短期変動スコアです。Hypixel公式のSecurity Block判定やban確率を再現したものではありません。</small>
    </div>
    {identity.status==='CHECKING'&&<div className="network-identity-note"><Radio size={17}/><span>BackendがPublic IP / ASN / 地域を確認しています。</span></div>}
    {identity.status==='UNAVAILABLE'&&<div className="network-identity-note"><Radio size={17}/><span>Backendのネットワーク診断を取得できません。Web単独起動または外部IP情報の取得失敗時はRiskをUnknownとして表示します。</span></div>}
  </section>
}
function Dashboard({data,active,live,pending,go,perform}:{data:Snapshot;active:number;live:number;pending:number;go:(p:Page)=>void;perform:(task:()=>void,success?:string)=>void}){
  const suspect=data.instances.filter(i=>i.status==='SUSPECT').length;
  const perf=data.performance,pathBots=perf?.pathfinding.bots.filter(p=>p.pathAttempts>0)||[];
  const pings=perf?.pathfinding.bots.map(p=>p.pingMs).filter((v):v is number=>v!==undefined)||[],averagePing=pings.length?Math.round(pings.reduce((a,b)=>a+b,0)/pings.length):undefined;
  const forgeWorkers=data.transport==='forge'?(data.forgeWorkers??[]).filter(worker=>worker.phase!=='STOPPED'):[];
  const resourceWorkers=forgeWorkers.filter(worker=>worker.cpuPercent!==undefined&&worker.rssMb!==undefined);
  const forgeCpu=resourceWorkers.length?resourceWorkers.reduce((sum,worker)=>sum+(worker.cpuPercent??0),0):undefined;
  const forgeRss=resourceWorkers.length?resourceWorkers.reduce((sum,worker)=>sum+(worker.rssMb??0),0):undefined;
  const forgeProcesses=resourceWorkers.reduce((sum,worker)=>sum+(worker.processCount??0),0);
  const forgeMode=data.transport==='forge';
  const networkIdentity:NonNullable<Snapshot['networkIdentity']>=data.networkIdentity??{
    status:'UNAVAILABLE',
    changed:false,
    risk:{level:'Unknown',reasons:[client.mode==='remote'?'Backend network diagnostic has not returned data':'Web-only / mock mode has no backend network diagnostic']}
  };
  return <div className="dashboard"><div className="hero-status"><div className="hero-icon"><Activity size={22}/></div><div><div className="eyebrow">FLEET STATUS</div><strong>{active} of {data.bots.length} bots online</strong><p>Java 1.8.9 <span className="bullet">·</span> {client.mode==='remote'?'Live backend':'Mock data'}</p></div><span className="hero-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></span></div>
    <div className="metrics"><div className="metric"><div className="metric-label"><BotIcon size={17}/> BOTS</div><strong>{active}<span> / {data.settings.maxBots}</span></strong><small>{live} in Pit</small></div><div className="metric"><div className="metric-label"><Layers3 size={17}/> INSTANCES</div><strong>{data.instances.length}</strong><small>{suspect?`${suspect} need attention`:'All observed'}</small></div><div className="metric"><div className="metric-label"><ListChecks size={17}/> OPEN JOBS</div><strong>{pending}</strong><small>{data.jobs.filter(j=>j.state==='RUNNING').length} running</small></div></div>
    <NetworkIdentityPanel identity={networkIdentity}/>
    {data.carePackages&&<CarePackagePanel schedule={data.carePackages} tracking={data.carePackageTracking}/>}
    {perf&&<section className="panel performance-panel"><SectionHead kicker="DIAGNOSTICS" title="Performance"/><div className="performance-metrics">
      <div><span>{forgeMode?'Forge CPU':'Backend CPU'}</span><strong>{forgeMode?(forgeCpu===undefined?'—':`${forgeCpu.toFixed(1)}%`):`${perf.runtime.cpuPercent.toFixed(1)}%`}</strong>{forgeMode&&<small>{resourceWorkers.length} worker · {forgeProcesses} processes</small>}</div>
      <div><span>{forgeMode?'Forge RSS memory':'Backend RSS memory'}</span><strong>{forgeMode?(forgeRss===undefined?'—':`${forgeRss.toFixed(1)} MB`):`${perf.runtime.rssMb.toFixed(1)} MB`}</strong>{forgeMode&&<small>HeadlessMC + Minecraft</small>}</div>
      <div><span>Backend event loop p99</span><strong>{perf.runtime.eventLoopP99Ms.toFixed(1)} ms</strong><small>Node control plane</small></div>
      <div><span>MC server ping</span><strong>{averagePing===undefined?'—':`${averagePing} ms`}</strong><small>{pings.length} bots reporting</small></div>
      <div><span>Path slots</span><strong>{perf.pathfinding.active} / {perf.pathfinding.concurrency}</strong><small>{perf.pathfinding.queued} queued</small></div>
    </div>
    {pathBots.length>0&&<div className="path-performance-list">{pathBots.slice(0,8).map(path=><div key={path.botId}><b className="mono">{path.botId}</b><span>Ping <strong>{path.pingMs===undefined?'—':`${path.pingMs} ms`}</strong></span><span>Move <strong>{path.activePathMs!==undefined?`${path.activePathMs} ms active`:path.lastPathMs!==undefined?`${path.lastPathMs} ms`:'—'}</strong></span><span>Queue <strong>{path.lastPathQueueMs!==undefined?`${path.lastPathQueueMs} ms`:'—'}</strong></span><span>Done / Fail <strong>{path.pathCompleted} / {path.pathFailed}</strong></span></div>)}</div>}
    </section>}
    <div className="dashboard-grid"><section className="panel roster-panel"><SectionHead kicker="LIVE ROSTER" title="Bots" action={<button className="link" onClick={()=>go('bots')}>View all <ArrowRight size={15}/></button>}/><div className="roster-list">{data.bots.slice(0,4).map(b=><BotCard key={b.id} bot={b} transport={data.transport} worker={data.forgeWorkers?.find(worker=>worker.botId===b.id)} compact onAction={perform}/>)}</div><button className="row-link" onClick={()=>go('bots')}><span>Manage all {data.bots.length} bots</span><ChevronRight size={17}/></button></section>
      <div className="dashboard-right"><section className="panel"><SectionHead kicker="NETWORK" title="Instances" action={<button className="link" onClick={()=>go('instances')}>View all <ArrowRight size={15}/></button>}/><div className="overview-instances">{data.instances.slice(0,4).map(i=><div className="instance-line" key={i.id}><span className={`ring ${tone(i.status)}`}><Layers3 size={16}/></span><div><strong className="mono">{i.id}</strong><small>{data.bots.filter(b=>b.instanceId===i.id).length} bots</small></div><Badge status={i.status}/></div>)}</div></section>
        <section className="panel recent-panel"><SectionHead kicker="ACTIVITY" title="Recent events" action={<button className="link" onClick={()=>go('logs')}>Logs <ArrowRight size={15}/></button>}/><div className="recent-list">{data.logs.slice(0,3).map(l=><div className="recent-row" key={l.id}><span className={`tiny-dot ${l.level.toLowerCase()}`}/><div><strong>{l.message}</strong><small>{rel(l.at)}</small></div></div>)}</div></section>
      </div></div>
  </div>
}
function SettingSelect({label,value,options,suffix='',onChange}:{label:string;value:number;options:number[];suffix?:string;onChange:(n:number)=>void}){
  return <div className="setting-row"><strong>{label}</strong><label className="select-wrap"><span className="sr-only">{label}</span><select value={value} onChange={e=>onChange(Number(e.target.value))}>{options.includes(value)?null:<option value={value}>{value}{suffix}</option>}{options.map(n=><option key={n} value={n}>{n}{suffix}</option>)}</select><ChevronDown size={13}/></label></div>
}
export { App };
