# Server Connection contract (backend integration pending)

The Settings form edits `{host, port, version}`. The Mock keeps it in memory until reload; no browser storage is an authority. The Remote client must load the saved value from BBot on startup and subscribe to backend setting updates. Authenticated, authorized routes:

| Route | Body | Response |
| --- | --- | --- |
| `GET /api/settings/server` | none | `{host,port,version,revision}` |
| `PUT /api/settings/server` | `{host,port,version}` only | Saved `{host,port,version,revision}` |
| `POST /api/settings/server/reconnect` | `{serverRevision}` only | `{botIds,serverRevision}` |

The backend validates again: nonempty hostname, IPv4 or IPv6 without URL syntax; integer port 1–65535; version in an allowlist currently containing only `1.8.9`. Reject unknown fields. Persist the setting on the BBot side and increment its revision atomically. `Save` must leave all current clients connected; the saved setting is used for future `mineflayer.createBot({host,port,version})` calls. A reconnect request compares its revision with the persisted setting. A mismatch is a conflict requiring refresh, so an old confirmation cannot reconnect to a different target.

The BotManager must determine which Bots are actually connected when the reconnect request is handled. It must invalidate each selected Bot's connection generation and Trade session, stop obsolete connect/recovery callbacks, disconnect that Bot and reconnect with the saved setting. Do not start disconnected Bots. Preserve its existing `CONNECTION_SPACING_MS` scheduling and check the setting revision, Bot generation and current client identity at every queued step. If the setting changes during the queue, cancel remaining work and invalidate outdated attempts. Return the selected Bot IDs as acknowledgement; the dashboard's existing realtime Bot updates report the actual outcome. `src/server/serverConnection.ts` is a request validation/integration reference, not a deployed route or persistent store. The BBot repository currently exposes no BotManager code to wire it to.
