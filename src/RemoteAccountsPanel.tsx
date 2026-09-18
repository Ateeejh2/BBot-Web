import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { bbotClient as client } from './client';
import type { Snapshot } from './client/types';

export function RemoteAccountsPanel({snapshot,notify}:{snapshot:Snapshot;notify:(message:string)=>void}){
  const [label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const add=async()=>{
    setBusy(true);setError('');
    try {await client.addMicrosoftAccount!(label);setLabel('');notify('Microsoft認証を開始しました。状態を確認してください。')}
    catch(e){setError(e instanceof Error?e.message:'Accountの追加に失敗しました')}
    finally{setBusy(false)}
  };
  const assign=async(botId:string,accountId:string|null)=>{
    setBusy(true);setError('');
    try {await client.assignAccount!(botId,accountId);notify(accountId?`${botId} にAccountを割り当てました`:`${botId} のAccount割当を解除しました`)}
    catch(e){setError(e instanceof Error?e.message:'割当に失敗しました')}
    finally{setBusy(false)}
  };
  const remove=async(accountId:string,label:string)=>{
    if(!window.confirm(`${label} をBBotから削除しますか？\nBotが使用中の場合は削除できません。Microsoft認証キャッシュは残ります。`))return;
    setBusy(true);setError('');
    try {await client.deleteAccount!(accountId);notify(`${label} を削除しました`)}
    catch(e){setError(e instanceof Error?e.message:'Accountの削除に失敗しました')}
    finally{setBusy(false)}
  };
  const retry=async(accountId:string)=>{
    setBusy(true);setError('');
    try {await client.retryAccount!(accountId);notify('Microsoft認証を再開しました')}
    catch(e){setError(e instanceof Error?e.message:'再試行に失敗しました')}
    finally{setBusy(false)}
  };
  return <section className="view-section"><div className="panel"><h2>Add Microsoft Account</h2>
    <p className="muted">本人認証はbackend側で行います。初回の案内はBBotの端末にだけ表示され、認証情報はWebには送られません。</p>
    <label className="field-label" htmlFor="remote-account-label">Display label</label>
    <input id="remote-account-label" value={label} maxLength={40} autoComplete="off" onChange={e=>setLabel(e.target.value)} placeholder="Scout_01"/>
    <div className="server-actions"><button className="button accent" disabled={busy||!/^\w[\w-]{0,39}$/.test(label)} onClick={()=>void add()}>Add Microsoft</button></div>
    <p className="muted">Session Accountは現在の認証ライブラリで安全なMicrosoftセッション入力経路を確認できないため非対応です。</p>
    {error&&<p role="alert" className="server-error">{error}</p>}
  </div>
  <div className="list-label">ACCOUNTS <span>{snapshot.accounts.length}</span></div>
  <div className="account-list">{snapshot.accounts.map(account=><div className="account-row" key={account.id}>
    <div className="account-avatar">{account.label.slice(0,1).toUpperCase()}</div>
    <div><strong>{account.minecraftName??account.label}</strong><span>{account.minecraftName?`${account.label} · `:''}Microsoft · {account.status} · {account.assignedBot??'Unassigned'}</span></div>
    <div className="server-actions">
      {account.status==='ERROR'?<button className="mini" disabled={busy} onClick={()=>void retry(account.id)}>Retry</button>:
        <span className="account-lock">{account.status==='READY'?'Ready':'Pending'}</span>}
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
      {snapshot.accounts.filter(a=>a.status==='READY'&&(a.assignedBot===undefined||a.assignedBot===bot.id)).map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select>
  </div>)}
  </section>;
}
