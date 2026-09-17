export const botStates = ['DISCONNECTED','CONNECTING','LOBBY','JOINING_PIT','IN_PIT_IDLE','PATHFINDING','WORKING','RECOVERING'] as const;
export type BotState = typeof botStates[number];
export type InstanceStatus = 'ACTIVE' | 'SUSPECT' | 'INACTIVE';
export type JobStatus = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type AccountKind = 'SESSION' | 'MICROSOFT';
export interface Bot { id:string; accountId:string; name:string; state:BotState; instanceId?:string; x:number;y:number;z:number; jobId?:string; updatedAt:number }
export interface Instance { id:string; status:InstanceStatus; firstSeen:number; lastSeen:number; metadata?:string }
export interface Job { id:string; eventType:string; instanceId:string; state:JobStatus; botId?:string; x:number;y:number;z:number; expiresAt:number }
export interface Account { id:string; label:string; kind:AccountKind; status:'READY'|'UNASSIGNED'; createdAt:number }
export interface LogEntry { id:number; at:number; level:'INFO'|'WARN'|'ERROR'; message:string; botId?:string; instanceId?:string; jobId?:string }
export interface Settings { maxBots:number; pathConcurrency:number; eventPollingSeconds:number; debug:boolean; javaVersion:'1.8.9' }
export interface Snapshot { bots:Bot[]; instances:Instance[]; jobs:Job[]; accounts:Account[]; logs:LogEntry[]; settings:Settings; revision:number }
export interface BBotClient {
  readonly mode:'mock'|'remote';
  getSnapshot():Snapshot;
  subscribe(listener:()=>void):()=>void;
  startBot(id:string):void;
  stopBot(id:string):void;
  recoverBot(id:string):void;
  setBotState(id:string,state:BotState):void;
  createBots(count:number):void;
  addInstance():void;
  setInstanceStatus(id:string,status:InstanceStatus):void;
  addAccount(label:string,kind:AccountKind):void;
  createJob(instanceId:string):void;
  setJobState(id:string,state:JobStatus):void;
  updateSettings(next:Partial<Settings>):void;
  reset():void;
}
