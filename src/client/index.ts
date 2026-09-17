import type { BBotClient } from './types';
import { MockBBotClient } from './mock';
// Change this composition root when the authenticated API is ready.
export const bbotClient:BBotClient = new MockBBotClient();
