import { useEffect, useState } from 'react';
import { bbotClient as client } from './client';
import { isConnectedBot, type Snapshot } from './client/types';
import { minecraftVersions, validateServerConnection, validServerHost, type MinecraftVersion, type ServerConnection } from './client/serverConnection';

export function ServerConnectionPanel({snapshot,notify}:{snapshot:Snapshot;notify:(message:string)=>void}){
  const saved=snapshot.serverConnection;
  const [host,setHost]=useState(saved.host),[portText,setPortText]=useState(String(saved.port)),[version,setVersion]=useState<MinecraftVersion>(saved.version);
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setHost(saved.host);setPortText(String(saved.port));setVersion(saved.version)},[saved.revision]);
  useEffect(()=>{if(!confirm)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setConfirm(false)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[confirm]);
  const port=/^\d+$/.test(portText)?Number(portText):NaN;
  let next:ServerConnection|null=null;
  try{next=validateServerConnection({host,port,version})}catch{/* Form stays editable. */}
  const connected=snapshot.bots.filter(bot=>isConnectedBot(bot.state)).length;
  const save=async(reconnect:boolean)=>{
    if(!next)return;
    setBusy(true);setError('');
    try{const updated=await client.saveServerConnection(next);
      if(reconnect){const result=await client.reconnectServer(updated.revision);notify(`${result.botIds.length} bots reconnecting to ${updated.host}:${updated.port}`)}
      else notify('Server Connection saved. Existing bots stay connected.');
      setConfirm(false);
    }catch(err){setError(err instanceof Error?err.message:'Server Connection の保存に失敗しました')}
    finally{setBusy(false)}
  };
  return <div className="panel server-connection"><h2>Server Connection</h2><p className="muted">Save は次回接続から適用します。MockではMinecraftに接続しません。</p>
    <div className="server-fields"><label htmlFor="server-host">Host</label><input id="server-host" value={host} onChange={event=>setHost(event.target.value)} placeholder="mc.example.com" autoComplete="off" spellCheck={false} aria-invalid={host!==''&&!validServerHost(host)}/>
      <label htmlFor="server-port">Port</label><input id="server-port" value={portText} onChange={event=>setPortText(event.target.value)} inputMode="numeric" placeholder="25565" aria-invalid={portText!==''&&(!Number.isInteger(port)||port<1||port>65535)}/>
      <label htmlFor="server-version">Minecraft Version</label><select id="server-version" value={version} onChange={event=>setVersion(event.target.value as MinecraftVersion)}>{minecraftVersions.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
    {error&&<p role="alert" className="server-error">{error}</p>}
    <div className="server-actions"><button className="button outline" disabled={!next||busy} onClick={()=>void save(false)}>Save</button><button className="button accent" disabled={!next||busy} onClick={()=>{setError('');setConfirm(true)}}>Save &amp; Reconnect</button></div>
    {confirm&&<div className="overlay" onClick={()=>!busy&&setConfirm(false)}><div className="sheet form-sheet server-confirm" role="dialog" aria-modal="true" aria-labelledby="reconnect-title" onClick={event=>event.stopPropagation()}><h2 id="reconnect-title">Reconnect {connected} bots to {host.includes(':')?`[${host}]`:host}:{portText}?</h2><p>接続中のBotのみ順番にMock再接続します。切断中のBotは起動しません。</p>{error&&<p role="alert" className="server-error">{error}</p>}<div className="server-actions"><button className="button outline" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="button accent" disabled={busy||!next} onClick={()=>void save(true)}>Save &amp; Reconnect</button></div></div></div>}
  </div>;
}
