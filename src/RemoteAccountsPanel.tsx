import { useRef, useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { bbotClient as client } from './client';
import type { MicrosoftAuthChallenge, Snapshot } from './client/types';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function RemoteAccountsPanel({snapshot,notify}:{snapshot:Snapshot;notify:(message:string)=>void}){
  const [label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [challenge,setChallenge]=useState<MicrosoftAuthChallenge|null>(null);
  const [kind,setKind]=useState<'MICROSOFT'|'SESSION'>('MICROSOFT');
  const accessToken=useRef<HTMLInputElement>(null);

  const waitForChallenge=async(accountId:string)=>{
    for(let i=0;i<40;i++){
      const found=await client.getMicrosoftAuthChallenge!(accountId);
      if(found)return found;
      await delay(250);
    }
    return null;
  };

  const signInUrl=(next:MicrosoftAuthChallenge)=>{
    try{
      const url=new URL(next.verificationUri);
      if(url.origin==='https://www.microsoft.com'&&url.pathname==='/link'){
        url.searchParams.set('otc',next.userCode);
        return url.toString();
      }
    }catch{/* Use the upstream verification URI as fallback. */}
    return next.verificationUri;
  };

  const showChallenge=(next:MicrosoftAuthChallenge,popup?:Window|null)=>{
    setChallenge(next);
    const url=signInUrl(next);
    try{
      if(popup&&!popup.closed)popup.location.replace(url);
    }catch{/* Fallback button remains available in the page. */}
    return url;
  };

  const add=async()=>{
    const popup=window.open('about:blank','bbot-ms-auth','popup,width=640,height=760');
    try{
      if(popup){
        popup.document.title='Microsoft sign-in';
        popup.document.body.textContent='Preparing Microsoft sign-in...';
      }
    }catch{/* Popup may be isolated by the browser. */}
    setBusy(true);setError('');setChallenge(null);
    try{
      const account=await client.addMicrosoftAccount!(label);
      setLabel('');
      const next=await waitForChallenge(account.id);
      if(next){
        showChallenge(next,popup);
        notify('Microsoft認証画面をコード入力済みで開きました。');
      }else{
        try{popup?.close()}catch{}
        notify('Accountを追加しました。PendingのSign inを押してください。');
      }
    }catch(e){
      try{popup?.close()}catch{}
      setError(e instanceof Error?e.message:'Accountの追加に失敗しました');
    }finally{setBusy(false)}
  };

  const openSignIn=async(accountId:string,popup?:Window|null)=>{
    setBusy(true);setError('');
    try{
      const next=await waitForChallenge(accountId);
      if(!next)throw Error('Microsoft認証案内をまだ取得できません。少し待って再試行してください');
      const url=showChallenge(next,popup);
      if(!popup||popup.closed)window.open(url,'_blank','noopener,noreferrer');
      notify('Microsoft認証画面をコード入力済みで開きました');
    }catch(e){setError(e instanceof Error?e.message:'Microsoft認証画面を開けませんでした')}
    finally{setBusy(false)}
  };

  const addSession=async()=>{
    const input={label,accessToken:accessToken.current?.value??''};
    if(accessToken.current)accessToken.current.value='';
    setBusy(true);setError('');
    try{
      const account=await client.addSessionAccount!(input);
      setLabel('');
      notify(`${account.minecraftName??account.label} をSession Accountとして追加しました`);
    }catch(e){
      setError(e instanceof Error?e.message:'Session Accountを追加できませんでした');
    }finally{setBusy(false)}
  };

  const assign=async(botId:string,accountId:string|null)=>{
    setBusy(true);setError('');
    try {await client.assignAccount!(botId,accountId);notify(accountId?`${botId} にAccountを割り当てました`:`${botId} のAccount割当を解除しました`)}
    catch(e){setError(e instanceof Error?e.message:'割当に失敗しました')}
    finally{setBusy(false)}
  };

  const remove=async(accountId:string,accountLabel:string,accountKind:'MICROSOFT'|'SESSION')=>{
    if(!window.confirm(`${accountLabel} をBBotから削除しますか？\nBotが使用中の場合は削除できません。${accountKind==='SESSION'?'Session credentialも削除されます。':'Microsoft認証キャッシュは残ります。'}`))return;
    setBusy(true);setError('');
    try {await client.deleteAccount!(accountId);if(challenge)setChallenge(null);notify(`${accountLabel} を削除しました`)}
    catch(e){setError(e instanceof Error?e.message:'Accountの削除に失敗しました')}
    finally{setBusy(false)}
  };

  const retry=async(accountId:string)=>{
    const popup=window.open('about:blank','bbot-ms-auth','popup,width=640,height=760');
    try{if(popup)popup.document.body.textContent='Preparing Microsoft sign-in...'}catch{}
    setBusy(true);setError('');setChallenge(null);
    try{
      await client.retryAccount!(accountId);
      const next=await waitForChallenge(accountId);
      if(!next)throw Error('Microsoft認証案内を取得できませんでした');
      showChallenge(next,popup);
      notify('Microsoft認証をコード入力済みで再開しました');
    }catch(e){
      try{popup?.close()}catch{}
      setError(e instanceof Error?e.message:'再試行に失敗しました');
    }finally{setBusy(false)}
  };

  return <section className="view-section"><div className="panel"><h2>Add Account</h2>
    <div className="server-actions"><button className="button outline" aria-pressed={kind==='MICROSOFT'} onClick={()=>setKind('MICROSOFT')}>Microsoft</button><button className="button outline" aria-pressed={kind==='SESSION'} onClick={()=>setKind('SESSION')}>Session</button></div>
    {kind==='MICROSOFT'&&<p className="muted">Add Microsoftを押すとMicrosoftのサインイン画面を開きます。Webには短時間だけdevice codeを表示しますが、access tokenやrefresh tokenは送信・保存しません。</p>}
    <label className="field-label" htmlFor="remote-account-label">Display label</label>
    <input id="remote-account-label" value={label} maxLength={40} autoComplete="off" onChange={e=>setLabel(e.target.value)} placeholder="Scout_01"/>
    {kind==='MICROSOFT'?<>
      <div className="server-actions"><button className="button accent" disabled={busy||!/^\w[\w-]{0,39}$/.test(label)} onClick={()=>void add()}>Add Microsoft</button></div>
      {challenge&&<div className="token-note" role="status"><div><strong>Microsoft sign-in</strong><div>Code: <code>{challenge.userCode}</code></div><button className="button outline" onClick={()=>window.open(signInUrl(challenge),'_blank','noopener,noreferrer')}><ExternalLink size={15}/> Open Microsoft sign-in</button><small>Microsoftの /link ページでは code をURLの otc パラメータに渡して事前入力します。対応しないverification URIでは通常の認証ページへ戻します。</small></div></div>}
    </>:<>
      <label className="field-label" htmlFor="session-access-token">Minecraft Access Token</label>
      <input id="session-access-token" ref={accessToken} type="password" autoComplete="off" maxLength={2048}/>
      <div className="server-actions"><button className="button accent" disabled={busy||!/^\w[\w-]{0,39}$/.test(label)} onClick={()=>void addSession()}>Add Session</button></div>
      <p className="muted">Minecraft ServicesのAccess Tokenだけで追加できます。backendがそのtokenでMCIDとProfile UUIDを取得し、token自体はWebSocket・Logs・runtime metadataには出しません。</p>
    </>}
    {error&&<p role="alert" className="server-error">{error}</p>}
  </div>
  <div className="list-label">ACCOUNTS <span>{snapshot.accounts.length}</span></div>
  <div className="account-list">{snapshot.accounts.map(account=><div className="account-row" key={account.id}>
    <div className="account-avatar">{account.label.slice(0,1).toUpperCase()}</div>
    <div><strong>{account.minecraftName??account.label}</strong><span>{account.minecraftName?`${account.label} · `:''}{account.kind==='SESSION'?'Session':'Microsoft'} · {account.status} · {account.assignedBot??'Unassigned'}</span></div>
    <div className="server-actions">
      {account.kind==='MICROSOFT'&&account.status==='ERROR'?<button className="mini" disabled={busy} onClick={()=>void retry(account.id)}>Retry</button>:
        account.kind==='MICROSOFT'&&account.status==='WAITING_FOR_LOGIN'?<button className="mini primary-mini" disabled={busy} onClick={()=>void openSignIn(account.id)}>Sign in</button>:
        <span className="account-lock">Ready</span>}
      <button className="mini" disabled={busy||Boolean(account.assignedBot&&snapshot.bots.find(b=>b.id===account.assignedBot)?.state!=='DISCONNECTED')} onClick={()=>void remove(account.id,account.label,account.kind)} title={account.assignedBot&&snapshot.bots.find(b=>b.id===account.assignedBot)?.state!=='DISCONNECTED'?'使用中のBotをStopしてから削除してください':'Accountを削除'}>
        <Trash2 size={14}/> Delete
      </button>
    </div>
  </div>)}</div>
  {snapshot.bots.map(bot=><div className="panel" key={bot.id}><h2>{bot.id} Account assignment</h2>
    <p className="muted">{bot.state==='DISCONNECTED'?'停止中にAccountを選択できます。':`現在 ${bot.state}。Stop後に変更できます。`}</p>
    <label className="field-label" htmlFor={`assign-${bot.id}`}>Assigned Account</label>
    <select id={`assign-${bot.id}`} value={bot.accountId} disabled={busy||bot.state!=='DISCONNECTED'} onChange={e=>void assign(bot.id,e.target.value||null)}>
      <option value="">Unassigned</option>
      {snapshot.accounts.filter(a=>a.status==='READY'&&(a.assignedBot===undefined||a.assignedBot===bot.id)).map(a=><option key={a.id} value={a.id}>{a.minecraftName??a.label}</option>)}
    </select>
  </div>)}
  </section>;
}
