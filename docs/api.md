# API Reference

All endpoints served by the Spring Boot backend on port 8080.

## Authentication

Two tokens exist: **admin** (increment) and **settings** (config + token
rotation). Pass either as `?token=<value>` or `Authorization: Bearer <value>`.

Resolution order per request: `tokens` DB table row, then the
`ADMIN_TOKEN` / `SETTINGS_TOKEN` env vars. A blank configured token never
authenticates. Everything not listed under "Admin endpoints" below is public.

## Public endpoints

### `GET /api/state`

Snapshot without subscribing to the event feed.

```json
GET /api/state?year=2026
{
  "year": 2026,
  "currentCount": 42,
  "initialCandyCount": 300,
  "candyRemaining": 258,
  "gameActive": false
}
```

`currentCount = COUNT(increment events) + settings.count_adjustment`.
`gameActive` reflects the in-memory game session, so a projection refreshed
mid-game can restore the overlay.

### `GET /api/events`

EventSource subscription (SSE, no timeout). One JSON payload per message:

```json
{"type":"increment","year":2026,"total":42,"initialCandyCount":300,"timestamp":"..."}
{"type":"vote","year":2026,"total":42,"initialCandyCount":300,"timestamp":"..."}

{"type":"effect_lightning","year":2026,"timestamp":"..."}
{"type":"effect_candy_rain","year":2026,"timestamp":"..."}

{"type":"game_status","active":true,"sessionId":"<uuid>","timestamp":"..."}
{"type":"zombie_spawned","zombieId":"12345","direction":0,"timestamp":"..."}
{"type":"zombie_missed","zombieId":"12345","timestamp":"..."}
```

Notes:
- `total` is always the increment total, even on `vote` messages.
- `initialCandyCount` rides along on count messages so supply changes made
  in settings reach every screen without a refresh.
- The server sends an SSE comment (`: keep-alive`) every 15s. EventSource
  ignores comments; they only keep proxies (Caddy, or anything else in the
  path) from dropping idle connections.
- A zombie hit also emits `effect_lightning` (no `year` field) so the
  projection flashes.
- Game messages mirror the WebSocket so the projection renders visuals
  without holding a WS connection.

### `POST /api/effects/lightning` / `POST /api/effects/candy-rain`

Trigger projection visuals. `year` query param optional (default 2026).
Server-side cooldown of 7s per effect type; within cooldown:

```json
HTTP 429 {"error": "effect_cooldown"}
```

On success the event is persisted and broadcast over SSE.

### `POST /api/vote`

Public vote for favorite candy. Stored as an event with `type='vote'`.

```json
POST /api/vote
{ "year": 2026, "candyType": "snickers" }
```

### `GET /api/stats`

Aggregates for the charts. Cross-year via `?year=2025` etc.

```json
GET /api/stats?year=2026
{
  "total": 42,
  "votes": { "snickers": 5, "m&ms": 3 },
  "histogram": [ { "minute": "2026-10-31T18:04:00Z", "count": 5 } ]
}
```

## Admin endpoints

### `POST /api/counter` (admin token)

Increment by one. Persists an event, then broadcasts the new total over SSE
after commit.

```json
POST /api/counter
{ "year": 2026 }
```

### `GET /api/settings` (settings token)

```json
GET /api/settings?year=2026
{
  "year": 2026,
  "initialCandyCount": 300,
  "countAdjustment": 5,
  "eventTotal": 42,
  "currentTotal": 47,
  "candyRemaining": 253
}
```

404 when no settings row exists for the year.

### `POST /api/settings` (settings token)

Missing fields are left unchanged. `currentTotal` is translated to
`countAdjustment = currentTotal - eventTotal`, preserving event history.
Pushes a count snapshot to all SSE clients.

```json
POST /api/settings
{ "year": 2026, "initialCandyCount": 400, "currentTotal": 42 }
```

### `POST /api/tokens/rotate` (settings token)

Generates a new 48-hex-char token, stored in the `tokens` table (overrides
the env var from then on). Valid names: `"admin"`, `"settings"`.

```json
POST /api/tokens/rotate
{ "name": "admin" }

{ "name": "admin", "token": "a1b2c3...", "warning": "QR codes must be regenerated: ..." }
```

QR codes embed tokens in URLs, so re-run `npm run qr` and re-print after
rotating. Emergency recovery: `DELETE FROM tokens;` falls back to env vars.

## WebSocket: `/ws/game`

Text frames, one JSON object each. One game session globally; a second
`game_start` while one is active is denied.

### Client to server

```json
{ "type": "game_start" }
{ "type": "game_start", "difficulty": "easy" }   // easy | hard | lightning
{ "type": "zombie_hit", "zombieId": "123" }
{ "type": "game_end" }
```

Unknown or missing `difficulty` falls back to `easy`. A `zombie_hit` with a
missing, malformed, unknown, or expired `zombieId` counts as exactly one
miss (-1); tapping an expired zombie also claims it, so the resolver cannot
charge the same zombie a second time, and its removal is broadcast over SSE.

### Server to client

```json
{ "type": "game_started", "sessionId": "<uuid>" }
{ "type": "game_start_denied", "reason": "already_active" }
{ "type": "zombie_spawned", "zombieId": "123", "direction": 0 }   // 0=left, 1=right
{ "type": "zombie_missed", "zombieId": "123" }
{ "type": "score_update", "result": "hit", "score": 3 }           // authoritative
{ "type": "game_ended", "score": 7 }
{ "type": "error", "reason": "unknown_type" }
```

`zombieId` is a server-generated long, sent as a string.

### Difficulty levels

| Level | Spawn interval | Zombie TTL | Hit score | Max concurrent |
|-----------|------|--------|----|---|
| easy | 600ms | 3000ms | +1 | 1 |
| hard | 400ms | 2000ms | +1 | 3 |
| lightning | 500ms | 1500ms | +2 | 1 |

Miss is always -1. Games auto-end after 30s; a disconnect ends the game
immediately.

## Increment flow

```
Client → POST /api/counter {"year":2026}
        ↓ CounterService saves the event
        ↓ AFTER_COMMIT event listener fires
        ↓ SseBroadcaster re-reads the total
        ↓ every EventSource gets {"type":"increment","total":42,...}
        ↓ clients update the big number
```
