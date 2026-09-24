import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Radio, RefreshCw, X } from 'lucide-react';
import type { Bot } from './client/types';

const storageKey = 'bbot.viewerUrlTemplate';

function resolveViewerUrl(template:string, botId:string):string|null {
  const expanded=template.trim().replaceAll('{botId}',encodeURIComponent(botId));
  if(!expanded)return null;
  try{
    const url=new URL(expanded);
    if(!['http:','https:'].includes(url.protocol))return null;
    if(window.location.protocol==='https:'&&url.protocol!=='https:')return null;
    return url.toString();
  }catch{return null}
}

export function LiveViewModal({bot,onClose,remoteViewer}:{bot:Bot;onClose:()=>void;remoteViewer?:{botId:string;url:string}|null}){
  const configured=(import.meta.env.VITE_BBOT_VIEWER_URL as string|undefined)?.trim()??'';
  const [draft,setDraft]=useState(()=>remoteViewer!==undefined?'':localStorage.getItem(storageKey)??configured);
  const [template,setTemplate]=useState(()=>remoteViewer!==undefined?'':localStorage.getItem(storageKey)??configured);
  const [reload,setReload]=useState(0);
  const viewerUrl=useMemo(()=>remoteViewer!==undefined
    ? remoteViewer?.botId===bot.id?resolveViewerUrl(remoteViewer.url,bot.id):null
    : resolveViewerUrl(template,bot.id),[template,bot.id,remoteViewer]);

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[onClose]);

  const apply=()=>{
    const clean=draft.trim();
    if(clean)localStorage.setItem(storageKey,clean);
    else localStorage.removeItem(storageKey);
    setTemplate(clean);
    setReload(value=>value+1);
  };

  return <div className="overlay live-overlay" onClick={onClose}>
    <section className="live-view-sheet" role="dialog" aria-modal="true" aria-labelledby="live-view-title" onClick={event=>event.stopPropagation()}>
      <header className="live-view-head">
        <div><span className="eyebrow">BOT VIEWER</span><h2 id="live-view-title">{bot.name} Live View</h2><p className="mono faint">{bot.id} · {bot.instanceId??'No instance'} · {bot.state}</p></div>
        <button className="icon-button" aria-label="Live Viewを閉じる" onClick={onClose}><X size={20}/></button>
      </header>
      <div className="live-view-toolbar">
        <div className="live-view-status"><Radio size={16}/><span>{bot.state==='DISCONNECTED'?'Bot offline':'Bot connected'}</span><b className="mono">{bot.x.toFixed(1)} / {bot.y.toFixed(1)} / {bot.z.toFixed(1)}</b></div>
        <button className="mini" disabled={!viewerUrl} onClick={()=>setReload(value=>value+1)}><RefreshCw size={14}/> Reload</button>
      </div>
      {remoteViewer===undefined&&<div className="viewer-url-row">
        <label htmlFor="viewer-url">Viewer URL</label>
        <div><input id="viewer-url" value={draft} onChange={event=>setDraft(event.target.value)} placeholder="https://viewer.example.com or .../{botId}/" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}/><button className="button outline" onClick={apply}>Load</button></div>
        <small>URLはこのブラウザだけに保存します。複数Bot構成では <code>{'{botId}'}</code> をURLテンプレートに使えます。HTTPSのBBot-WebではViewer側もHTTPSが必要です。</small>
      </div>}
      <div className="viewer-frame-wrap">
        {viewerUrl?<iframe key={`${bot.id}:${reload}:${viewerUrl}`} className="viewer-frame" src={viewerUrl} title={`${bot.name} Minecraft Live View`} sandbox="allow-scripts allow-same-origin allow-pointer-lock" allow="fullscreen; gamepad" referrerPolicy="no-referrer"/>:
          <div className="viewer-empty"><Radio size={32}/><strong>{remoteViewer!==undefined?'Viewerを待っています':'Viewer URLを設定してください'}</strong><p>{remoteViewer!==undefined?'BBot側のViewerが起動すると、この画面に自動で3D視点が表示されます。Codespacesではsetup:web-controlがViewer URLを自動設定します。':'BBot backendのprismarine-viewer公開URLを入力すると、ここにBotの3D視点が表示されます。'}</p></div>}
      </div>
      {viewerUrl&&<a className="viewer-open-link" href={viewerUrl} target="_blank" rel="noreferrer">別タブで開く <ExternalLink size={14}/></a>}
    </section>
  </div>;
}
