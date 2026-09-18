import { useState } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { bbotClient as client } from './client';
import type { MicrosoftAuthChallenge, Snapshot } from './client/types';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function RemoteAccountsPanel({snapshot,notify}:{snapshot:Snapshot;notify:(message:string)=>void}){
  const [label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [challenge,setChallenge]=useState<MicrosoftAuthChallenge|null>(null);

  const waitForChallenge=async(accountId:string)=>{
    for(let i=0;i<40;i++){
      const found=await client.getMicrosoftAuthChallenge!(accountId);
      if(found)return found;
      await delay(250);
    }
    return null;
  };

  const copyCode=async(code:string)=>{
    try{await navigator.clipboard.writeText(code);return true}catch{return false}
  };

  const showChallenge=async(next:MicrosoftAuthChallenge,popup?:Window|null)=>{
    setChallenge(next);
    const copied=await copyCode(next.userCode);
    try{
      if(popup&&!popup.closed)popup.location.replace(next.verificationUri);
    }catch{/* Fallback button remains available in the page. */}
    return copied;
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
        const copied=await showChallenge(next,popup);
        notify(copied?'Microsoft認証画面を開き、コードをクリップボードにコピーしました。':'Microsoft認証画面を開きました。コードをコピーして入力してください。');
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
      const copied=await showChallenge(next,popup);
      if(!popup||popup.closed)window.open(next.verificationUri,'_blank','noopener,noreferrer');
      notify(copied?'認証コードをコピーしてMicrosoft画面を開きました':'Microsoft画面を開きました');
    }catch(e){setError(e instanceof Error?e.message:'Microsoft認証画面を開けませんでした')}
    finally{setBusy(false)}
  };

  const assign=async(botId:string,accountId:string|null)=>{
    setBusy(true);setError('');
    try {await client.assignAccount!(botId,accountId);notify(accountId?`${botId} にAccountを割り当てました`:`${botId} のAccount割当を解除しました`)}
    catch(e){setError(e instanceof Error?e.message:'割当に失敗しました')}
    finally{setBusy(false)}
  };

  const remove=async(accountId:string,accountLabel:string)=>{
    if(!window.confirm(`${accountLabel} をBBotから削除しますか？\nBotが使用中の場合は削除できません。Microsoft認証キャッシュは残ります。`))return;
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
      const copied=await showChallenge(next,popup);
      notify(copied?'Microsoft認証を再開し、コードをコピーしました':'Microsoft認証を再開しました');
    }catch(e){
      try{popup?.close()}catch{}
      setError(e instanceof Error?e.message:'再試行に失敗しました');
    }finally{setBusy(false)}
  };

  return <section className="view-section"><div className="panel"><h2>Add Microsoft Account</h2>
    <p className="muted">Add Microsoftを押すとMicrosoftのサインイン画面を開きます。Webには短時間だけdevice codeを表示しますが、access tokenやrefresh tokenは送信・保存しません。</p>
    <label className="field-label" htmlFor="remote-account-label">Display label</label>
    <input id="remote-account-label" value={label} maxLength={40} autoComplete="off" onChange={e=>setLabel(e.target.value)} placeholder="Scout_01"/>
    <div className="server-actions"><button className="button accent" disabled={busy||!/^\w[\w-]{0,39}$/.test(label)} onClick={()=>void add()}>Add Microsoft</button></div>
    {challenge&&<div className="token-note" role="status"><div><strong>Microsoft sign-in</strong><div>Code: <code>{challenge.userCode}</code></div><button className="button outline" onClick={()=>void copyCode(challenge.userCode).then(()=>window.open(challenge.verificationUri,'_blank','noopener,noreferrer'))}><ExternalLink size={15}/> Copy code & open Microsoft</button><small>MicrosoftのDevice Code Flowではコードの事前入力はできないため、ここではコードを自動コピーして認証画面を開きます。貼り付けだけ行ってください。</small></div></div>}
    <p className="muted">Session Accountは現在の認証ライブラリで安全なMicrosoftセッション入力経路を確認できないため非対応です。</p>
    {error&&<p role="alert" className="server-error">{error}</p>}
  </div>
  <div className="list-label">ACCOUNTS <span>{snapshot.accounts.length}</span></div>
  <div className="account-list">{snapshot.accounts.map(account=><div className="account-row" key={account.id}>
    <div className="account-avatar">{account.label.slice(0,1).toUpperCase()}</div>
    <div><strong>{account.minecraftName??account.label}</strong><span>{account.minecraftName?`${account.label} · `:''}Microsoft · {account.status} · {account.assignedBot??'Unassigned'}</span></div>
    <div className="server-actions">
      {account.status==='ERROR'?<button className="mini" disabled={busy} onClick={()=>void retry(account.id)}>Retry</button>:
        account.status==='WAITING_FOR_LOGIN'?<button className="mini primary-mini" disabled={busy} onClick={()=>void openSignIn(account.id)}>Sign in</button>:
        <span className="account-lock">Ready</span>}
      <button className="mini" disabled={busy||Boolean(account.assignedBot&&snapshot.bots.find(b=>b.id===account.assignedBot)?.state!=='DISCONNECTED')} onClick={()=>void remove(account.id,account.label)} title={account.assignedBot&&snapshot.bots.find(b=>b.id===account.assignedBot)?.state!=='DISCONNECTED'?'使用中のBotをStopしてから削除してください':'Accountを削除'}>
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
