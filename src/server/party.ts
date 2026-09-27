/** Backend integration boundary. Wire this to the current BotManager client before exposing routes. */
import { canSendMinecraftCommand, validMinecraftUsername, type BotState, type PartyCommandResult } from '../client/types';

export interface PartyBotClient { id:string; state:BotState; chat(command:string):void }
export type ResolvePartyBot = (botId:string)=>PartyBotClient|undefined;

function ready(resolveBot:ResolvePartyBot,botId:string):PartyBotClient {
  const bot=resolveBot(botId);
  if(!bot||bot.id!==botId)throw Error('Bot が見つかりません');
  if(!canSendMinecraftCommand(bot.state))throw Error('Bot は現在commandを送信できません');
  return bot;
}

/** POST /api/bots/:botId/party/invite — reject unexpected fields, then build the command server-side. */
export function sendPartyInvite(resolveBot:ResolvePartyBot,botId:string,body:unknown):PartyCommandResult {
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!Object.hasOwn(body,'targetUsername'))throw Error('targetUsername のみ指定してください');
  const targetUsername=(body as {targetUsername:unknown}).targetUsername;
  if(typeof targetUsername!=='string'||!validMinecraftUsername(targetUsername))throw Error('Minecraft ID が不正です');
  const bot=ready(resolveBot,botId);
  bot.chat(`/p ${targetUsername}`);
  return {status:'SENT',message:`Party command sent to ${targetUsername}`};
}

/** POST /api/bots/:botId/party/warp — no request body is accepted. */
export function sendPartyWarp(resolveBot:ResolvePartyBot,botId:string,body?:unknown):PartyCommandResult {
  if(body!==undefined&&body!==null)throw Error('Warp に入力項目はありません');
  const bot=ready(resolveBot,botId);
  bot.chat('/p warp');
  return {status:'SENT',message:'Party warp command sent'};
}
