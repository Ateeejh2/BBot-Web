import type { ReconnectResult, ServerConnection, ServerConnectionRecord } from './serverConnection';
export const botStates = ['DISCONNECTED','CONNECTING','LOBBY','JOINING_PIT','IN_PIT_IDLE','PREPARING_EVENT','PATHFINDING','WORKING','RECOVERING'] as const;
export type BotState = typeof botStates[number];
export type InstanceStatus = 'ACTIVE' | 'SUSPECT' | 'INACTIVE';
export type JobStatus = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type AccountKind = 'SESSION' | 'MICROSOFT';
export interface Bot { id:string; accountId:string; name:string; state:BotState; startQueued?:boolean; instanceId?:string; x:number;y:number;z:number; jobId?:string; updatedAt:number; kickReason?:string; kickedAt?:number }
export type ForgeWorkerPhase = 'STOPPED'|'LAUNCHING'|'LAUNCHED'|'STOPPING';
export interface ForgeWorker { botId:string; phase:ForgeWorkerPhase; bridgePort:number; lastError?:string }
export interface Instance { id:string; status:InstanceStatus; firstSeen:number; lastSeen:number; metadata?:string }
export type JobFailureReason = 'PATH_NOT_FOUND'|'PATH_TIMEOUT'|'PATH_CANCELLED'|'PATH_REJECTED'|'PATH_FAILED'|'INSTANCE_LOST'|'JOB_EXPIRED'|'TASK_TIMEOUT'|'TASK_FAILED';
export interface Job { id:string; eventType:string; instanceId:string; state:JobStatus; botId?:string; x:number;y:number;z:number; expiresAt:number; attempts?:number; maxAttempts?:number; lastFailure?:JobFailureReason; lastFailureAt?:number; retryAt?:number }
export interface JobCreateInput { instanceId:string; eventType:string; target:{x:number;y:number;z:number}; expiresAt:number }
export interface RuntimePerformance { cpuPercent:number; rssMb:number; heapUsedMb:number; heapTotalMb:number; eventLoopMeanMs:number; eventLoopP99Ms:number; eventLoopMaxMs:number; uptimeSeconds:number }
export interface BotPathPerformance { botId:string; pingMs?:number; pathAttempts:number; pathCompleted:number; pathFailed:number; activePathMs?:number; lastPathMs?:number; lastPathQueueMs?:number }
export interface PerformanceSnapshot { runtime:RuntimePerformance; pathfinding:{active:number;queued:number;concurrency:number;bots:BotPathPerformance[]} }
export interface CarePackageSchedule { source:'brookeafk.com'; sourceUrl:string; updatedAt?:number; status:'OK'|'STALE'|'UNAVAILABLE'; events:Array<{timestamp:number}> }
export interface CarePackageTracking { timestamp?:number; instances:Array<{instanceId:string;state:'ARMED'|'STARTED'|'CARRIER_DETECTED'|'LAUNCHING'|'DROPPED'|'CHEST_DETECTED'|'LAUNCH_FAILED';startedAt?:number;area?:string;target?:{x:number;y:number;z:number}}> }
export interface Account { id:string; label:string; kind:AccountKind; status:'READY'|'UNASSIGNED'|'WAITING_FOR_LOGIN'|'ERROR'; minecraftName?:string; assignedBot?:string; createdAt:number; authError?:'SESSION_TOKEN_INVALID' }
export interface MicrosoftAuthChallenge { verificationUri:string; userCode:string; expiresAt:number }
export interface SessionAccountInput { label:string; accessToken:string }
export interface FleetActionResult { started?:string[]; stopped?:string[]; skipped?:Array<{botId:string;reason:string}> }
export interface LogEntry { id:number; at:number; level:'INFO'|'WARN'|'ERROR'; message:string; botId?:string; instanceId?:string; jobId?:string }
export interface ChatLogEntry { id:number; at:number; botId:string; instanceId?:string; channel:string; text:string }
export interface Settings { maxBots:number; pathConcurrency:number; eventPollingSeconds:number; debug:boolean; javaVersion:'1.8.9' }
export type TradeStatus = 'IDLE'|'REQUESTING'|'WAITING_FOR_GUI'|'OPEN'|'CLOSED'|'COMPLETED'|'TIMEOUT'|'ERROR';
export interface TradeItem { name:string; count:number; icon?:string; lore?:string[]; enchantments?:string[]; durability?:number; metadata?:number }
export interface TradeWindow { windowId:number; title:string; type:string; slotCount:number; slots:(TradeItem|null)[]; inventory:(TradeItem|null)[]; hotbar:(TradeItem|null)[] }
export interface TradeState { status:TradeStatus; tradeSessionId:string|null; targetUsername:string|null; revision:number; window:TradeWindow|null; error?:string }
export interface TradeClickRequest { tradeSessionId:string; windowId:number; slot:number; revision:number }
export const validMinecraftUsername = (value:string):boolean => /^[A-Za-z0-9_]{1,16}$/.test(value);
export const canSendMinecraftCommand = (state:BotState):boolean => ['LOBBY','IN_PIT_IDLE','PATHFINDING','WORKING'].includes(state);
export const isConnectedBot = (state:BotState):boolean => ['LOBBY','JOINING_PIT','IN_PIT_IDLE','PREPARING_EVENT','PATHFINDING','WORKING'].includes(state);
export interface PartyCommandResult { status:'SENT'|'REJECTED'; message:string; serverMessage?:string }
export interface Snapshot { bots:Bot[]; forgeWorkers?:ForgeWorker[]; instances:Instance[]; jobs:Job[]; accounts:Account[]; logs:LogEntry[]; chatLogs:ChatLogEntry[]; settings:Settings; serverConnection:ServerConnectionRecord; trades:Record<string,TradeState>; revision:number; transport?:'mineflayer'|'forge'; performance?:PerformanceSnapshot; carePackages?:CarePackageSchedule; carePackageTracking?:CarePackageTracking; movementDebug?:boolean; viewer?:{botId:string;url:string}|null; remoteConnected?:boolean }
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
  launchForge?(id:string):Promise<void>;
  quitForge?(id:string):Promise<void>;
  startAssignedBots?():Promise<FleetActionResult>;
  stopAllBots?():Promise<FleetActionResult>;
  joinPit?(id:string):void|Promise<void>;
  testLaunchPad?(id:string):void|Promise<void>;
  testCarePackage?(id:string):void|Promise<void>;
  oofBot?(id:string):void|Promise<void>;
  setMovementDebug?(enabled:boolean):Promise<void>;
  recoverBot(id:string):void;
  setBotState(id:string,state:BotState):void;
  createBots(count:number):void;
  addInstance():void;
  setInstanceStatus(id:string,status:InstanceStatus):void;
  addAccount(label:string,kind:AccountKind):void;
  addMicrosoftAccount?(label:string):Promise<Account>;
  addSessionAccount?(input:SessionAccountInput):Promise<Account>;
  replaceSessionToken?(accountId:string,accessToken:string):Promise<Account>;
  getMicrosoftAuthChallenge?(accountId:string):Promise<MicrosoftAuthChallenge|null>;
  retryAccount?(accountId:string):Promise<void>;
  assignAccount?(botId:string,accountId:string|null):Promise<void>;
  deleteAccount?(accountId:string):Promise<void>;
  createJob(instanceId:string):void;
  submitJob?(input:JobCreateInput):Promise<Job>;
  setJobState(id:string,state:JobStatus):void;
  updateSettings(next:Partial<Settings>):void;
  reset():void;
}
