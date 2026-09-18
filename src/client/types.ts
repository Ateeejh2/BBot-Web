import type { ReconnectResult, ServerConnection, ServerConnectionRecord } from './serverConnection';
export const botStates = ['DISCONNECTED','CONNECTING','LOBBY','JOINING_PIT','IN_PIT_IDLE','PATHFINDING','WORKING','RECOVERING'] as const;
export type BotState = typeof botStates[number];
export type InstanceStatus = 'ACTIVE' | 'SUSPECT' | 'INACTIVE';
export type JobStatus = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type AccountKind = 'SESSION' | 'MICROSOFT';
export interface Bot { id:string; accountId:string; name:string; state:BotState; instanceId?:string; x:number;y:number;z:number; jobId?:string; updatedAt:number; kickReason?:string; kickedAt?:number }
export interface Instance { id:string; status:InstanceStatus; firstSeen:number; lastSeen:number; metadata?:string }
export interface Job { id:string; eventType:string; instanceId:string; state:JobStatus; botId?:string; x:number;y:number;z:number; expiresAt:number }
export interface Account { id:string; label:string; kind:AccountKind; status:'READY'|'UNASSIGNED'|'WAITING_FOR_LOGIN'|'ERROR'; minecraftName?:string; assignedBot?:string; createdAt:number }
export interface MicrosoftAuthChallenge { verificationUri:string; userCode:string; expiresAt:number }
export interface SessionAccountInput { label:string; accessToken:string }
export interface LogEntry { id:number; at:number; level:'INFO'|'WARN'|'ERROR'; message:string; botId?:string; instanceId?:string; jobId?:string }
export interface Settings { maxBots:number; pathConcurrency:number; eventPollingSeconds:number; debug:boolean; javaVersion:'1.8.9' }
export type TradeStatus = 'IDLE'|'REQUESTING'|'WAITING_FOR_GUI'|'OPEN'|'CLOSED'|'COMPLETED'|'TIMEOUT'|'ERROR';
export interface TradeItem { name:string; count:number; icon?:string; lore?:string[]; enchantments?:string[]; durability?:number; metadata?:number }
export interface TradeWindow { windowId:number; title:string; type:string; slotCount:number; slots:(TradeItem|null)[]; inventory:(TradeItem|null)[]; hotbar:(TradeItem|null)[] }
export interface TradeState { status:TradeStatus; tradeSessionId:string|null; targetUsername:string|null; revision:number; window:TradeWindow|null; error?:string }
export interface TradeClickRequest { tradeSessionId:string; windowId:number; slot:number; revision:number }
export const validMinecraftUsername = (value:string):boolean => /^[A-Za-z0-9_]{1,16}$/.test(value);
export const canSendMinecraftCommand = (state:BotState):boolean => ['LOBBY','IN_PIT_IDLE','PATHFINDING','WORKING'].includes(state);
export const isConnectedBot = (state:BotState):boolean => ['LOBBY','JOINING_PIT','IN_PIT_IDLE','PATHFINDING','WORKING'].includes(state);
export interface PartyCommandResult { status:'SENT'|'REJECTED'; message:string; serverMessage?:string }
export interface Snapshot { bots:Bot[]; instances:Instance[]; jobs:Job[]; accounts:Account[]; logs:LogEntry[]; settings:Settings; serverConnection:ServerConnectionRecord; trades:Record<string,TradeState>; revision:number; viewer?:{botId:string;url:string}|null; remoteConnected?:boolean }
export interface BBotClient {
  readonly mode:'mock'|'remote';
  getSnapshot():Snapshot;
  subscribe(listener:()=>void):()=>void;
  getServerConnection():ServerConnectionRecord|Promise<ServerConnectionRecord>;
  saveServerConnection(next:ServerConnection):ServerConnectionRecord|Promise<ServerConnectionRecord>;
  reconnectServer(serverRevision:number):ReconnectResult|Promise<ReconnectResult>;
  getTradeState(botId:string):TradeState;
  startTrade(botId:string,targetUsername:string):void;
  clickTradeSlot(botId:string,request:TradeClickRequest):void;
  cancelTrade(botId:string):void;
  /** Mock-only debug operation; remote implementations must reject it. */
  simulateTradeTimeout(botId:string):void;
  inviteParty(botId:string,targetUsername:string):PartyCommandResult|Promise<PartyCommandResult>;
  warpParty(botId:string):PartyCommandResult|Promise<PartyCommandResult>;
  startBot(id:string):void|Promise<void>;
  stopBot(id:string):void|Promise<void>;
  joinPit?(id:string):void|Promise<void>;
  recoverBot(id:string):void;
  setBotState(id:string,state:BotState):void;
  createBots(count:number):void;
  addInstance():void;
  setInstanceStatus(id:string,status:InstanceStatus):void;
  addAccount(label:string,kind:AccountKind):void;
  addMicrosoftAccount?(label:string):Promise<Account>;
  addSessionAccount?(input:SessionAccountInput):Promise<Account>;
  getMicrosoftAuthChallenge?(accountId:string):Promise<MicrosoftAuthChallenge|null>;
  retryAccount?(accountId:string):Promise<void>;
  assignAccount?(botId:string,accountId:string|null):Promise<void>;
  deleteAccount?(accountId:string):Promise<void>;
  createJob(instanceId:string):void;
  setJobState(id:string,state:JobStatus):void;
  updateSettings(next:Partial<Settings>):void;
  reset():void;
}
