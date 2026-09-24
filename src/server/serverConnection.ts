/** Route integration reference for BBot backend; not included in the browser bundle. */
import { validateServerConnection, type ReconnectResult, type ServerConnection, type ServerConnectionRecord } from '../client/serverConnection';

export interface ServerConnectionStore {
  get():Promise<ServerConnectionRecord>;
  save(next:ServerConnection):Promise<ServerConnectionRecord>;
}
export interface ReconnectCoordinator {
  /** BotManager owns generation invalidation and CONNECTION_SPACING_MS scheduling. */
  reconnectConnectedBots(connection:ServerConnectionRecord):Promise<ReconnectResult>;
}
export const getServerConnection = (store:ServerConnectionStore)=>store.get();
export async function putServerConnection(store:ServerConnectionStore,body:unknown):Promise<ServerConnectionRecord> {
  // Never trust the browser's validation or accept a command/extra field.
  return store.save(validateServerConnection(body));
}
export async function postServerReconnect(store:ServerConnectionStore,coordinator:ReconnectCoordinator,body:unknown):Promise<ReconnectResult> {
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'serverRevision'))throw Error('serverRevision のみ指定してください');
  const revision=(body as {serverRevision:unknown}).serverRevision,current=await store.get();
  if(!Number.isInteger(revision)||revision!==current.revision)throw Error('Server Connection のrevisionが古いです');
  return coordinator.reconnectConnectedBots(current);
}
