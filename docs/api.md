# API Reference

Complete list of endpoints, working session by session graph of several things.

## Public endpoints

### `GET /api/state`
Snapshot without projection event feed.

```json
GET /api/state?year=2026
{
  "year": 2026,
  "currentCount": 42,
  "initialCandyCount": 300,
  "candyRemaining": 258
}
```

### `GET /api/events`
EventSource subscription. Returns SSE stream forever (no timeout). Broadcasts typed payload:

increment / vote / effects (lifecycle):
```json
{"type":"increment","year":2026,"total":42,"timestamp":"..."}
```

game status:
```json
{"type":"game_status","active":true,"sessionId":"uuid","timestamp":"..."}
{"type":"game_status","active":false,"sessionId":"uuid","timestamp":"..."}
{"type":"zombie_spawned","zombieId":"12345","direction":0,"timestamp":"..."}
{"type":"zombie_missed","zombieId":"12345","timestamp":"..."}
```

### `POST /api/effects/lightning` / `POST /api/effects/candy-rain`
Trigger visual effects. Params year query-param optional.

```
POST /api/effects/lightning?year=2026  → event saved + 200
POST /api/effects/candy-rain?year=2026 → event saved + 200
```

### `POST /api/vote`
Public vote for favorite candy. Body `VoteRequest`.

```json
POST /api/vote
{ "year": 2026, "candyType": "snickers" }
```

Stores candyType in `events` with type='vote'.

### `GET /api/stats`
Aggregated statistics for graphs.

```json
GET /api/stats?year=2026
{
  "total": 42,
  "votes": {"snickers": 5, "m&ms": 3},
  "histogram": [
    { "minute": "...", "count": 5 },
    { "minute": "...", "count": 3 }
  ]
}
```

History cross-year uses `stats?year=2025` etc.

## Admin endpoints (token)

### `POST /api/counter`
Increment counter.

```json
POST /api/counter (admin-token)
{ "year": 2026 }
```

### `GET /api/settings`
Fetch settings + current tally.

```json
GET /api/settings?year=2026 (settings-token)
{
  "year": 2026,
  "initialCandyCount": 300,
  "countAdjustment": 5,
  "eventTotal": 42,
  "currentTotal": 47,
  "candyRemaining": 253
}
```

### `POST /api/settings`
Update settings. Body: any missing field not updated.

```json
POST /api/settings (settings-token)
{ "year": 2026, "initialCandyCount": 400, "currentTotal": 42 }
```

`currentTotal` is renamed internal value countAdjustment = currentTotal - eventTotal.

## WebSocket (`/ws/game`)

Client renders JS on phones and makes pretty messages.

### Client → Server

```json
{ "type": "game_start" }
{ "type": "zombie_hit" }          // missing zombieId → -1 score
{ "type": "zombie_hit", "zombieId": "123" } // hit active zombie → +1 score
{ "type": "game_end" }
```

### Server → Client

```json
{ "type": "game_started", "sessionId": "uuid" }
{ "type": "game_start_denied", "reason": "already_active" }
{ "type": "zombie_spawned", "zombieId": "123", "direction": 0 }  // direction: 0 = left, 1 = right
{ "type": "zombie_missed", "zombieId": "123" }
{ "type": "game_ended", "score": 7 }
```

Direction identifiers come from the spawn graphs. `zombieId` is a `long` treated as a number, positive within JS's max-safe-integer and it has any valid varying values when the callback sequence finishes.

## Pictorially

```
Client → POST /api/counter {"year":2026}
        ↓ (CounterService increments)
        ↓ (AFTER_COMMIT event publish)
        ↓ SseBroadcaster.send(total message)
        ↓ EventSource gets {..., total: 42}
        ↓ Client updates big numbers
```

Session starters are makes completed uncompleted events, let's mutex together promotion files from the package.
