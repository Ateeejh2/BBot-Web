import type { BBotClient } from './types';
import { MockBBotClient } from './mock';
import { RemoteBBotClient } from './remote';
export const bbotClient:BBotClient = import.meta.env.VITE_BBOT_MODE === 'remote' ? new RemoteBBotClient() : new MockBBotClient();
