import { useEffect, useState, useSyncExternalStore } from 'react';
import { Activity, ArrowRight, Bot as BotIcon, Check, ChevronDown, ChevronRight, CircleHelp, Database, LayoutDashboard, Layers3, ListChecks, MoreHorizontal, Play, Plus, Power, Radio, RotateCcw, ScrollText, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { bbotClient as client } from './client';
import { botStates, type AccountKind, type Bot, type BotState, type InstanceStatus, type JobStatus, type LogEntry, type Snapshot } from './client/types';
type Page = 'dashboard'|'bots'|'instances'|'jobs'|'accounts'|'settings'|'logs';
const nav:{id:Page;label:string;icon:typeof LayoutDashboard}[] = [
  {id:'dashboard',label:'Overview',icon:LayoutDashboard},{id:'bots',label:'Bots',icon:BotIcon},
  {id:'instances',label:'Instances',icon:Layers3},{id:'jobs',label:'Jobs',icon:ListChecks},
  {id:'accounts',label:'Accounts',icon:Users},{id:'settings',label:'Settings',icon:Settings2},
  {id:'logs',label:'Logs',icon:ScrollText}
];
const short:Record<BotState,string> = {DISCONNECTED:'Offline',CONNECTING:'Connecting',LOBBY:'Lobby',JOINING_PIT:'Joining Pit',IN_PIT_IDLE:'Idle',PATHFINDING:'Pathfinding',WORKING:'Working',RECOVERING:'Recovering'};
const tone=(s:string)=> ['IN_PIT_IDLE','ACTIVE','READY','COMPLETED'].includes(s)?'good':['PATHFINDING','WORKING','RUNNING','ASSIGNED'].includes(s)?'teal':['SUSPECT','RECOVERING','CONNECTING','JOINING_PIT','QUEUED'].includes(s)?'amber':['FAILED','EXPIRED'].includes(s)?'red':'quiet';
const rel=(time:number)=>{const m=Math.max(0,Math.floor((Date.now()-time)/60000));return m<1?'たった今':m<60?`${m}分前`:m<1440?`${Math.floor(m/60)}時間前`:`${Math.floor(m/1440)}日前`};
function Badge({status,label}:{status:string;label?:string}){return <span className={`badge ${tone(status)}`}><span className="badge-dot" aria-hidden="true" />{label??status}</span>}
function Empty({title,detail}:{title:string;detail:string}){return <div className="empty"><Database size={26}/><strong>{title}</strong><p>{detail}</p></div>}
function SectionHead({kicker,title,action}:{kicker?:string;title:string;action?:React.ReactNode}){return <div className="section-head"><div>{kicker&&<span className="eyebrow">{kicker}</span>}<h2>{title}</h2></div>{action}</div>}
function BotCard({bot,compact,onAction}:{bot:Bot;compact?:boolean;onAction:(task:()=>void)=>void}){
  const active=bot.state!=='DISCONNECTED';
  return <article className={`bot-card ${compact?'compact':''}`}>
    <div className="bot-main"><div className={`bot-avatar ${tone(bot.state)}`}><BotIcon size={21} strokeWidth={1.8}/></div>
      <div className="bot-identity"><strong>{bot.name}</strong><span className="mono faint">{bot.id} · {bot.instanceId??'No instance'}</span></div>
      <Badge status={bot.state} label={short[bot.state]}/></div>
    {!compact&&<div className="bot-details"><span>Position <b className="mono">{bot.instanceId?`${bot.x} / ${bot.y} / ${bot.z}`:'—'}</b></span><span>Job <b className="mono">{bot.jobId??'—'}</b></span></div>}
    <div className="card-actions">
      {!active?<button className="mini primary-mini" onClick={()=>onAction(()=>client.startBot(bot.id))}><Play size={15}/> Start</button>:<button className="mini" onClick={()=>onAction(()=>client.stopBot(bot.id))}><Power size={15}/> Stop</button>}
      {active&&<button className="mini" onClick={()=>onAction(()=>client.recoverBot(bot.id))}><RotateCcw size={15}/> Recover</button>}
      {!compact&&<label className="select-wrap"><span className="sr-only">{bot.name} の状態</span><select value={bot.state} onChange={e=>onAction(()=>client.setBotState(bot.id,e.target.value as BotState))} aria-label={`${bot.name} の状態を試す`}>
        {botStates.map(s=><option key={s} value={s}>{s}</option>)}</select><ChevronDown size={13}/></label>}
    </div>
  </article>
}
function InstanceCard({id,status,count,lastSeen,onAction}:{id:string;status:InstanceStatus;count:number;lastSeen:number;onAction:(task:()=>void)=>void}){
  return <article className="instance-card"><div className="instance-top"><div className="instance-icon"><Layers3 size={19}/></div><Badge status={status}/></div>
    <h3 className="mono">{id}</h3><p className="muted">{count} bots assigned <span className="bullet">·</span> seen {rel(lastSeen)}</p>
    <div className="instance-actions"><button className="text-button" onClick={()=>onAction(()=>client.setInstanceStatus(id,status==='ACTIVE'?'SUSPECT':'ACTIVE'))}>Mark {status==='ACTIVE'?'suspect':'active'} <ArrowRight size={14}/></button></div></article>
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
  useEffect(()=>{if(!more&&!accountOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMore(false);setAccountOpen(false)}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[more,accountOpen]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3700);return()=>clearTimeout(timer)},[toast]);
  const go=(v:Page)=>{setPage(v);setMore(false);setFilter('all');setQuery('');window.scrollTo({top:0,behavior:'smooth'});};
  const perform=(task:()=>void,success='Mockを更新しました')=>{try{task();setToast(success);}catch(err){setToast(err instanceof Error?err.message:'操作に失敗しました')}};
  const active=snapshot.bots.filter(b=>b.state!=='DISCONNECTED').length;
  const live=snapshot.bots.filter(b=>['IN_PIT_IDLE','PATHFINDING','WORKING'].includes(b.state)).length;
  const pending=snapshot.jobs.filter(j=>['QUEUED','ASSIGNED','RUNNING'].includes(j.state)).length;
  const current=nav.find(n=>n.id===page)!;
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">B<span>.</span></span><div><strong>BBot</strong><small>CONTROL ROOM</small></div></div>
      <div className="sidebar-label">WORKSPACE</div><nav className="side-nav" aria-label="メインナビゲーション">{nav.map(n=><NavButton key={n.id} {...n} page={page} setPage={go}/>)}</nav>
      <div className="sidebar-bottom"><div className="connector"><span className="signal-ring"><Radio size={16}/></span><div><b>Mock environment</b><small>BBot本体には未接続</small></div></div><div className="build-meta">BBOT CONSOLE <span>v0.1 · JAVA 1.8.9</span></div></div>
    </aside>
    <div className="mobile-top"><div className="mobile-brand"><span className="brand-mark">B<span>.</span></span><b>BBot</b></div><span className="mobile-mode"><span className="mode-dot"/> MOCK MODE</span></div>
    <main className="content" id="main"><div className="desktop-top"><div className="breadcrumb">WORKSPACE <ChevronRight size={14}/> {current.label.toUpperCase()}</div><div className="top-right"><span className="version-pill">JAVA EDITION <b>1.8.9</b></span><span className="mode-pill"><span className="mode-dot"/> MOCK MODE</span></div></div>
      <div className="page-head"><div><div className="eyebrow">BBOT / {current.label.toUpperCase()}</div><h1>{page==='dashboard'?'Command center':current.label}</h1><p>{({dashboard:'20クライアントまでを見渡す、Mockの管理画面。',bots:'各Botの状態と操作をまとめて確認。',instances:'発見したPit instanceの状態を確認。',jobs:'イベントの割当と進行状況を確認。',accounts:'Session Accountの表示と追加を試す。',settings:'Mock環境の表示設定と動作値。',logs:'Mock操作の履歴。秘密情報は記録しません。'} as Record<Page,string>)[page]}</p></div>
        {page==='bots'&&<button className="button accent" disabled={snapshot.bots.length>=20} onClick={()=>perform(()=>{client.updateSettings({maxBots:20});client.createBots(20)},'20 BotのMock状態を生成しました')}><Plus size={17}/> Generate 20 Bots</button>}
        {page==='instances'&&<button className="button accent" onClick={()=>perform(()=>client.addInstance(),'新しいInstanceを観測しました')}><Plus size={17}/> Add instance</button>}
        {page==='accounts'&&<button className="button accent" onClick={()=>setAccountOpen(true)}><Plus size={17}/> Add account</button>}
      </div>
      {page==='dashboard'&&<Dashboard data={snapshot} active={active} live={live} pending={pending} go={go} perform={perform}/>}
      {page==='bots'&&<section className="view-section"><div className="toolbar"><div className="filter-row" role="group" aria-label="Bot絞り込み">{[['all','All'],['active','Active'],['idle','Idle'],['offline','Offline']].map(([v,l])=><button key={v} className={`filter ${filter===v?'is-active':''}`} onClick={()=>setFilter(v)}>{l}</button>)}</div><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Bot / Instance を検索" aria-label="Bot検索"/></div></div>
        <div className="list-label">FLEET <span>{snapshot.bots.length} / {snapshot.settings.maxBots} BOTS</span></div>
        <div className="bot-grid">{snapshot.bots.filter(b=>(filter==='all'||filter==='active'&&b.state!=='DISCONNECTED'||filter==='offline'&&b.state==='DISCONNECTED'||filter==='idle'&&b.state==='IN_PIT_IDLE')&&(b.name.toLowerCase().includes(query.toLowerCase())||b.id.includes(query.toLowerCase())||b.instanceId?.includes(query.toLowerCase()))).map(b=><BotCard key={b.id} bot={b} onAction={perform}/>)}</div>
        {!snapshot.bots.some(b=>(filter==='all'||filter==='active'&&b.state!=='DISCONNECTED'||filter==='offline'&&b.state==='DISCONNECTED'||filter==='idle'&&b.state==='IN_PIT_IDLE')&&(b.name.toLowerCase().includes(query.toLowerCase())||b.instanceId?.includes(query.toLowerCase())))&&<Empty title="該当するBotがありません" detail="条件を変更して確認してください。"/>}</section>}
      {page==='instances'&&<section className="view-section"><div className="insight"><Activity size={18}/><p>Instance一覧は固定ではありません。Mockで追加・状態変更を試せます。確認済みの集合であり、総instance数ではありません。</p></div>
        <div className="list-label">OBSERVED INSTANCES <span>{snapshot.instances.length} FOUND</span></div><div className="instance-grid">{snapshot.instances.map(i=><InstanceCard key={i.id} id={i.id} status={i.status} count={snapshot.bots.filter(b=>b.instanceId===i.id).length} lastSeen={i.lastSeen} onAction={perform}/>)}</div></section>}
      {page==='jobs'&&<section className="view-section"><div className="job-actions"><label>Mock event for <select value={jobInstance} onChange={e=>setJobInstance(e.target.value)}>{snapshot.instances.map(i=><option key={i.id} value={i.id}>{i.id}</option>)}</select></label><button className="button accent" onClick={()=>perform(()=>client.createJob(jobInstance),'Mock Jobを追加しました')}><Plus size={17}/> Create job</button></div>
        <div className="list-label">JOB QUEUE <span>{snapshot.jobs.length} TOTAL</span></div><div className="job-list">{snapshot.jobs.map(j=><article className="job-card" key={j.id}><div className="job-header"><div className="job-icon"><ListChecks size={18}/></div><div className="job-title"><strong>{j.eventType}</strong><span className="mono faint">{j.id} · {j.instanceId}</span></div><Badge status={j.state}/></div><div className="job-foot"><span className="mono">{j.x} / {j.y} / {j.z}</span><span>{j.botId??'Unassigned'}</span></div><div className="job-state"><span>Mock status</span><label className="select-wrap"><select aria-label={`${j.id} の状態`} value={j.state} onChange={e=>perform(()=>client.setJobState(j.id,e.target.value as JobStatus))}>{(['QUEUED','ASSIGNED','RUNNING','COMPLETED','FAILED','EXPIRED'] as JobStatus[]).map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={13}/></label></div></article>)}</div></section>}
      {page==='accounts'&&<section className="view-section"><div className="insight"><ShieldCheck size={20}/><p>Session AccountはUIのみ。Mockではtokenを入力・保持せず、Bot本体への認証も行いません。</p></div><div className="list-label">ACCOUNTS <span>{snapshot.accounts.length} ADDED</span></div><div className="account-list">{snapshot.accounts.map(a=><div className="account-row" key={a.id}><div className="account-avatar">{a.label.slice(0,1).toUpperCase()}</div><div><strong>{a.label}</strong><span>{a.kind==='SESSION'?'Session Account':'Microsoft Account'} · {a.status==='UNASSIGNED'?'Unassigned':'Mock ready'}</span></div><span className="account-lock"><ShieldCheck size={16}/><span>No token</span></span></div>)}</div></section>}
      {page==='settings'&&<section className="view-section settings-grid"><div className="panel"><div className="panel-icon"><Settings2 size={21}/></div><h2>Mock configuration</h2><p className="muted">この画面だけの一時設定。再読み込みで初期状態に戻ります。</p>
        <SettingSelect label="Bot limit" value={snapshot.settings.maxBots} options={[6,10,15,20]} onChange={value=>perform(()=>client.updateSettings({maxBots:value}))}/>
        <SettingSelect label="Pathfinding concurrency" value={snapshot.settings.pathConcurrency} options={[1,2,3,4]} onChange={value=>perform(()=>client.updateSettings({pathConcurrency:value}))}/>
        <SettingSelect label="Event polling interval" value={snapshot.settings.eventPollingSeconds} options={[5,10,30,60]} suffix="s" onChange={value=>perform(()=>client.updateSettings({eventPollingSeconds:value}))}/>
        <div className="setting-row"><div><strong>Debug mode</strong><small>追加のMock診断表示</small></div><button role="switch" aria-checked={snapshot.settings.debug} aria-label="Debug mode" onClick={()=>perform(()=>client.updateSettings({debug:!snapshot.settings.debug}))} className={`toggle ${snapshot.settings.debug?'on':''}`}><span/></button></div>
      </div><div className="panel"><div className="panel-icon"><CircleHelp size={21}/></div><h2>Environment</h2><div className="about-line"><span>Data source</span><b>MockBBotClient</b></div><div className="about-line"><span>Minecraft</span><b>Java 1.8.9</b></div><div className="about-line"><span>Backend</span><b>Not connected</b></div><p className="muted note">本番用REST / WebSocketクライアントは未接続です。操作はMinecraft Botへ送信されません。</p><button className="button outline full" onClick={()=>{client.reset();setToast('Mock状態を初期化しました')}}><RotateCcw size={16}/> Reset mock data</button></div></section>}
      {page==='logs'&&<section className="view-section"><div className="list-label">ACTIVITY FEED <span>LATEST {snapshot.logs.length}</span></div><div className="log-list">{snapshot.logs.map((l:LogEntry)=><article className="log-row" key={l.id}><span className={`log-mark ${l.level.toLowerCase()}`}><Activity size={15}/></span><div><strong>{l.message}</strong><span className="mono faint">{[l.botId,l.instanceId,l.jobId].filter(Boolean).join(' / ')||'system'}</span></div><time>{rel(l.at)}</time></article>)}</div></section>}
      <footer className="footer">BBOT CONSOLE <span>MOCK ONLY · JAVA 1.8.9</span></footer>
    </main>
    <nav className="bottom-nav" aria-label="モバイルナビゲーション">{nav.slice(0,4).map(n=><NavButton key={n.id} {...n} page={page} setPage={go}/>)}<button className={`nav-button ${['accounts','settings','logs'].includes(page)?'selected':''}`} aria-expanded={more} onClick={()=>setMore(true)}><MoreHorizontal size={20}/><span>More</span></button></nav>
    {more&&<div className="overlay" onClick={()=>setMore(false)}><div className="sheet" role="dialog" aria-modal="true" aria-label="その他の画面" onClick={e=>e.stopPropagation()}><div className="sheet-head"><b>More</b><button className="icon-button" aria-label="閉じる" onClick={()=>setMore(false)}><X size={21}/></button></div>{nav.slice(4).map(n=><button className="sheet-item" key={n.id} onClick={()=>go(n.id)}><n.icon size={19}/>{n.label}<ChevronRight size={17}/></button>)}<div className="sheet-foot">MOCK MODE · JAVA EDITION 1.8.9</div></div></div>}
    {accountOpen&&<div className="overlay" onClick={()=>setAccountOpen(false)}><div className="sheet form-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={e=>e.stopPropagation()}><div className="sheet-head"><b id="account-title">Add account</b><button className="icon-button" aria-label="閉じる" onClick={()=>setAccountOpen(false)}><X size={21}/></button></div><div className="form-body"><div className="type-tabs" role="group" aria-label="Account方式"><button className={accountKind==='SESSION'?'chosen':''} onClick={()=>setAccountKind('SESSION')}>Session Account</button><button className={accountKind==='MICROSOFT'?'chosen':''} onClick={()=>setAccountKind('MICROSOFT')}>Microsoft</button></div><label className="field-label" htmlFor="account-label">Display label</label><input id="account-label" maxLength={40} value={accountLabel} onChange={e=>setAccountLabel(e.target.value)} placeholder="例: Scout 07" autoComplete="off"/><div className="token-note"><ShieldCheck size={19}/><span>Mockではtoken入力を行いません。秘密情報は保持・保存されません。</span></div><button className="button accent full" onClick={()=>{try{client.addAccount(accountLabel,accountKind);setAccountOpen(false);setAccountLabel('');setToast('Mock Accountを追加しました')}catch(err){setToast(err instanceof Error?err.message:'追加に失敗しました')}}}><Plus size={17}/> Add Mock account</button></div></div></div>}
    {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  </div>
}
function Dashboard({data,active,live,pending,go,perform}:{data:Snapshot;active:number;live:number;pending:number;go:(p:Page)=>void;perform:(task:()=>void,success?:string)=>void}){
  const suspect=data.instances.filter(i=>i.status==='SUSPECT').length;
  return <div className="dashboard"><div className="hero-status"><div className="hero-icon"><Activity size={22}/></div><div><div className="eyebrow">FLEET STATUS</div><strong>{active} of {data.bots.length} bots online</strong><p>Java 1.8.9 <span className="bullet">·</span> Mock data <span className="bullet">·</span> No live connection</p></div><span className="hero-wave" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></span></div>
    <div className="metrics"><div className="metric"><div className="metric-label"><BotIcon size={17}/> BOTS</div><strong>{active}<span> / {data.settings.maxBots}</span></strong><small>{live} in Pit</small></div><div className="metric"><div className="metric-label"><Layers3 size={17}/> INSTANCES</div><strong>{data.instances.length}</strong><small>{suspect?`${suspect} need attention`:'All observed'}</small></div><div className="metric"><div className="metric-label"><ListChecks size={17}/> OPEN JOBS</div><strong>{pending}</strong><small>{data.jobs.filter(j=>j.state==='RUNNING').length} running</small></div></div>
    <div className="dashboard-grid"><section className="panel roster-panel"><SectionHead kicker="LIVE ROSTER" title="Bots" action={<button className="link" onClick={()=>go('bots')}>View all <ArrowRight size={15}/></button>}/><div className="roster-list">{data.bots.slice(0,4).map(b=><BotCard key={b.id} bot={b} compact onAction={perform}/>)}</div><button className="row-link" onClick={()=>go('bots')}><span>Manage all {data.bots.length} bots</span><ChevronRight size={17}/></button></section>
      <div className="dashboard-right"><section className="panel"><SectionHead kicker="NETWORK" title="Instances" action={<button className="link" onClick={()=>go('instances')}>View all <ArrowRight size={15}/></button>}/><div className="overview-instances">{data.instances.slice(0,4).map(i=><div className="instance-line" key={i.id}><span className={`ring ${tone(i.status)}`}><Layers3 size={16}/></span><div><strong className="mono">{i.id}</strong><small>{data.bots.filter(b=>b.instanceId===i.id).length} bots</small></div><Badge status={i.status}/></div>)}</div></section>
        <section className="panel recent-panel"><SectionHead kicker="ACTIVITY" title="Recent events" action={<button className="link" onClick={()=>go('logs')}>Logs <ArrowRight size={15}/></button>}/><div className="recent-list">{data.logs.slice(0,3).map(l=><div className="recent-row" key={l.id}><span className={`tiny-dot ${l.level.toLowerCase()}`}/><div><strong>{l.message}</strong><small>{rel(l.at)}</small></div></div>)}</div></section>
      </div></div>
  </div>
}
function SettingSelect({label,value,options,suffix='',onChange}:{label:string;value:number;options:number[];suffix?:string;onChange:(n:number)=>void}){
  return <div className="setting-row"><strong>{label}</strong><label className="select-wrap"><span className="sr-only">{label}</span><select value={value} onChange={e=>onChange(Number(e.target.value))}>{options.includes(value)?null:<option value={value}>{value}{suffix}</option>}{options.map(n=><option key={n} value={n}>{n}{suffix}</option>)}</select><ChevronDown size={13}/></label></div>
}
export { App };
