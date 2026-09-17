import type { BBotClient } from './types';
/** Contract placeholder. No fetch, WebSocket, or token handling exists in this build. */
export type RemoteBBotClient = BBotClient & { readonly mode:'remote' };
// A future implementation must make authenticated requests via a secure backend,
// implement subscribe over WebSocket, and never persist a session token in browser storage.
