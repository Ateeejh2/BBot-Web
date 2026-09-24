export const minecraftVersions = ['1.8.9'] as const;
export type MinecraftVersion = typeof minecraftVersions[number];
export interface ServerConnection { host:string; port:number; version:MinecraftVersion }
export interface ServerConnectionRecord extends ServerConnection { revision:number }
export interface ReconnectResult { botIds:string[]; serverRevision:number }
export const defaultServerConnection:ServerConnectionRecord = {host:'mc.example.com',port:25565,version:'1.8.9',revision:0};

export function validServerHost(host:string):boolean {
  if(typeof host!=='string'||!host||host!==host.trim()||host.length>253||/[\s/@?#\[\]\\]/.test(host))return false;
  if(host.includes(':')){
    if(!/^[0-9a-fA-F:.]+$/.test(host))return false;
    try {const url=new URL(`http://[${host}]/`);return url.hostname.startsWith('[')&&url.hostname.endsWith(']');}catch{return false;}
  }
  if(host.endsWith('.')&&/^(?:\d+\.){3}\d+\.$/.test(host))return false;
  if(/^(?:\d+\.){3}\d+$/.test(host))return host.split('.').every(part=>/^(?:0|[1-9]\d*)$/.test(part)&&Number(part)<=255);
  if(/^[\d.]+$/.test(host)&&host.includes('.'))return false;
  const labels=host.endsWith('.')?host.slice(0,-1).split('.'):host.split('.');
  return labels.every(label=>label.length>=1&&label.length<=63&&/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}
export function validateServerConnection(input:unknown):ServerConnection {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Server Connection が不正です');
  const value=input as Record<string,unknown>;
  if(Object.keys(value).length!==3||!Object.hasOwn(value,'host')||!Object.hasOwn(value,'port')||!Object.hasOwn(value,'version'))throw Error('Host、Port、Minecraft Version のみ指定してください');
  if(typeof value.host!=='string'||!validServerHost(value.host))throw Error('有効なhostname / IPv4 / IPv6を入力してください');
  if(typeof value.port!=='number'||!Number.isInteger(value.port)||value.port<1||value.port>65535)throw Error('Portは1〜65535の整数です');
  if(typeof value.version!=='string'||!minecraftVersions.some(v=>v===value.version))throw Error('未対応のMinecraft Versionです');
  return {host:value.host,port:value.port,version:value.version as MinecraftVersion};
}
