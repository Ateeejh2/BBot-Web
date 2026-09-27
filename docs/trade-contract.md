# Trade API contract (proposed, not connected)

`BBotClient` exposes `startTrade(botId, targetUsername)`, `clickTradeSlot(botId, request)`, `cancelTrade(botId)`, `getTradeState(botId)` and `subscribe`. The Preview uses only `MockBBotClient`. A future Remote client must send JSON over an authenticated backend boundary; no Minecraft session token or arbitrary command belongs in browser requests.

| Operation | Request | Result |
| --- | --- | --- |
| `POST /api/bots/:botId/trade` | `{ "targetUsername": "PlayerName" }` | Trade state snapshot |
| `POST /api/bots/:botId/trade/click` | `{ "tradeSessionId": "...", "windowId": 1, "slot": 27, "revision": 4 }` | Accepted acknowledgement only; authoritative state arrives later |
| `DELETE /api/bots/:botId/trade` | no body | Invalidated state |
| `GET /api/bots/:botId/trade` | no body | Current state snapshot |
| WebSocket `trade.snapshot` | `{ "botId": "bot-01", "trade": TradeState }` | Replace only if session matches and revision is newer; a new session replaces the old one |

Backend validates the target against `^[A-Za-z0-9_]{1,16}$` again, then constructs `/trade ${targetUsername}` itself. Reject additional body fields and arbitrary command strings. A start is rejected while the same Bot is REQUESTING, WAITING_FOR_GUI or OPEN. The server alone assigns opaque session IDs, window IDs and increasing per-Bot revisions. It checks authentication/authorization and all five click fields against its current OPEN session, including integer slot bounds and exact current revision, before a normal left click. Return conflict on stale state; client refreshes. Never trust a browser supplied window layout.

For Mineflayer integration, a BotManager owned Trade controller binds its listeners to the current Bot client and generation. On start it enters REQUESTING, sends the constructed command, enters WAITING_FOR_GUI, and starts configurable `TRADE_OPEN_TIMEOUT_MS` as a **client-side safety timeout**. It is not Hypixel request expiration. On `windowOpen`, a standalone `TradeWindowMatcher` evaluates the *measured* raw 1.8.9 title and window metadata. Until a Windows capture establishes a matcher, default to rejecting every window rather than guessing `You Other`. Debug capture includes only raw title, normalized title, type and slot count, with secrets excluded. Unrelated windows do not complete the request. After a timeout, a late window cannot be assigned to that session; generation and current client identity are checked before every async transition and click.

On a matched window, OPEN snapshots contain the container slots, player inventory and hotbar, with item name, count, optional icon, lore, enchantments, durability and metadata. Observe `windowOpen`, `windowClose`, slot/window updates and inventory updates; emit only the affected Bot's snapshot via WebSocket after the server state changes. The Web never commits an item move based on the click acknowledgement. Closing a window yields CLOSED unless a reliable server signal establishes COMPLETED or ERROR. Disconnect, server transfer, respawn and recovery invalidate the session immediately, remove listeners and timers, and prevent old async work from acting on a new Bot generation.

Windows 1.8.9 test checklist: capture actual raw and normalized Trade GUI title, type and slot count; verify unrelated GUI rejection; measure accept/open timing and adjust the safety timeout; verify click slot numbering, item metadata and server updates; inspect close and success messages without inferring completion from close alone. Official Pit Update 0.4 confirms request via `/trade <username>`, open after acceptance, eligible item clicks, reaccept after changes with a three second timer, and a 60 second same-player request restriction. Neither the raw title nor request expiration duration is established by that source.

## Party and Warp

`BBotClient.inviteParty(botId, targetUsername)` and `warpParty(botId)` return `{status:'SENT'|'REJECTED', message, serverMessage?}`. `SENT` acknowledges dispatch only; a later server error may be surfaced separately. No GUI wait or Trade session applies.

| Operation | Request | Backend action |
| --- | --- | --- |
| `POST /api/bots/:botId/party/invite` | `{ "targetUsername": "ExamplePlayer" }` only | Validate against `^[A-Za-z0-9_]{1,16}$`, resolve the exact Bot, call its current Mineflayer client with `/p ExamplePlayer` |
| `POST /api/bots/:botId/party/warp` | no body | Resolve the exact Bot and call its current client with the fixed `/p warp` |

Authenticate and authorize each route. Resolve the current BotManager client at dispatch time; reject DISCONNECTED, CONNECTING, RECOVERING and other transitional states. Reject unknown fields, command strings and a warp body. Check the current client generation when wiring the routes into BBot to avoid sending through a replaced client. `src/server/party.ts` is a tested backend integration reference, not a deployed API route; the Preview imports neither it nor Mineflayer. Mock operations only produce per-Bot UI notifications and logs.
