# API Reference

All endpoints served by the Spring Boot backend on port 8080.

## Authentication

Two tokens exist: **admin** (increment) and **settings** (config + token
rotation). Pass either as `?token=<value>` or `Authorization: Bearer <value>`.

Resolution order per request: `tokens` DB table row, then the
`ADMIN_TOKEN` / `SETTINGS_TOKEN` env vars. A blank configured token never
authenticates. Everything not listed under "Admin endpoints" below is public.

## Event types

The application writes these event types to `events`:

| `type`              | Written by                     | Extra columns |
| ------------------- | ------------------------------ | ------------- |
| `increment`         | `POST /api/counter`            | -             |
| `effect_lightning`  | `POST /api/effects/lightning`  | -             |
| `effect_candy_rain` | `POST /api/effects/candy-rain` | -             |
| `game_score`        | `GameService`, when a game ends | `score`, `game_session_id`, `initials`, `avg_ms` |

`game_score` is written server-side at game end, not by any HTTP endpoint,
and is what `GET /api/leaderboard` lists. Rows written before Graveyard Bonk
(V7) have no `initials` and are left off the leaderboard. Existing databases
delete historical vote rows and the voting schema in `V10__remove_candy_voting.sql`.
Adding an event type requires a Flyway migration - see
`V6__game_score_type.sql`.

## Public endpoints

Every endpoint that is per-year takes `year` explicitly (query param, or
in the JSON body for `POST`s); a missing `year` is a 400. Clients send the
browser's current year (`src/year.ts`).

### `GET /api/state`

Snapshot without subscribing to the event feed.

```json
GET /api/state?year=2026
{
  "year": 2026,
  "currentCount": 42,
  "initialCandyCount": 300,
  "candyRemaining": 258,
  "gameActive": true,
  "gameInitials": "JB",
  "gameEndsInMs": 12000
}
```

`currentCount = COUNT(increment events) + settings.count_adjustment`.
`gameActive`, `gameInitials` and `gameEndsInMs` reflect the in-memory game
session (`null` / `0` when none), so a projection or phone refreshed
mid-game can catch up.

### `GET /api/events`

EventSource subscription (SSE, no timeout). One JSON payload per message:

```json
{"type":"increment","year":2026,"total":42,"initialCandyCount":300,"timestamp":"..."}

{"type":"effect_lightning","year":2026,"timestamp":"..."}
{"type":"effect_candy_rain","year":2026,"timestamp":"..."}

{"type":"game_status","active":true,"sessionId":"<uuid>","initials":"JB","endsInMs":33000,"upMs":1500,"zombieCount":13,"timestamp":"..."}
{"type":"game_pop","id":3,"grave":7,"kind":"zombie","timestamp":"..."}
{"type":"game_bonk","id":3,"grave":7,"kind":"zombie","verdict":"bonk","ms":287,"points":748,"score":2310,"timestamp":"..."}
{"type":"game_tap","x":1.2,"z":-0.4,"timestamp":"..."}
{"type":"game_result","initials":"JB","score":3140,"avgMs":301,"rank":4,"scoreId":42,"timestamp":"..."}
```

Notes:

- `initialCandyCount` rides along on count messages so supply changes made
  in settings reach every screen without a refresh.
- The server sends an SSE comment (`: keep-alive`) every 15s. EventSource
  ignores comments; they only keep proxies (Caddy, or anything else in the
  path) from dropping idle connections.
- Game messages mirror the WebSocket so the projection renders the game
  without holding a WS connection. The projection draws its own lightning
  per `game_bonk`; no `effect_lightning` is sent for game events.
- `game_status` with `active:false` ends a game. `endsInMs` counts the
  countdown plus play time. `game_result` follows with the rank and the
  leaderboard row id (`rank`/`scoreId` are `null` if nothing was saved).
  Each message goes out on its own thread, so `game_result` can arrive
  before the `game_status` that ends the game.
- `game_tap` carries world coordinates (the graveyard's ground plane), not
  screen pixels, so the projection's camera draws the splat in the same
  spot. Relayed at most once per 100ms.

### `POST /api/effects/lightning` / `POST /api/effects/candy-rain`

Trigger projection visuals. `year` query param required.
Server-side cooldown per effect type, shared by all viewers: 350ms for
lightning (under three flashes a second) and 250ms for candy rain. Within
the cooldown:

```json
HTTP 429 {"error": "effect_cooldown"}
```

While a game is running, so lightning keeps meaning "bonk":

```json
HTTP 409 {"error": "game_active"}
```

On success the event is persisted and broadcast over SSE.

### `GET /api/stats`

Aggregates for the charts. Cross-year via `?year=2025` etc.

```json
GET /api/stats?year=2026
{
  "total": 42,
  "histogram": [ { "minute": "2026-10-31T18:04:00Z", "count": 5 } ]
}
```

`histogram` buckets increment events by minute.

### `GET /api/leaderboard`

Graveyard Bonk scores for a year, best first; ties go to whoever scored
first. `limit` defaults to and is capped at 500.

```json
GET /api/leaderboard?year=2026&limit=5
[
  { "id": 42, "initials": "JB", "score": 3140, "avgMs": 301, "timestamp": "2026-10-31T19:12:04Z" }
]
```

`avgMs` is `null` for a game with no real bonks. `id` is what the phone's
results screen links to as `/stats#score-<id>`.

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

A year with no settings row yet (a new Halloween) reads as the defaults:
`initialCandyCount` 300, `countAdjustment` 0. The row is created on the
first `POST`.

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

QR codes embed tokens in URLs, so after rotating, get both live tokens with
`make tokens`, re-run `npm run qr` and re-print. Emergency recovery: `DELETE FROM tokens;` falls back to env vars.

## WebSocket: `/ws/game` (Graveyard Bonk)

Text frames, one JSON object each. One game globally; a second
`game_start` while one is active is denied. The phone runs the game on its
own clock from the schedule in `game_started`, so network lag never counts
toward a reaction time.

```
phone                                      server
  game_start {initials} ───────────────>   sanitize initials, build schedule
  <───────────── game_started {pops, ...}
  (3s countdown, then pops due at atMs)
  pop_shown {id}   first frame drawn ──>   relay as game_pop
  bonk {id, ms}    tap - drawn ────────>   judge, score, relay as game_bonk
  <───────────── score_update {points, score}
  tap {x, z}       hit nothing ────────>   relay as game_tap (throttled)
  game_quit        ✕, End game? ───────>   end now (same as the timer)
                   ... 30s + 1s grace ...  persist, rank
  <───────────── game_ended {score, avgMs, rank, scoreId}
```

### Client to server

```json
{ "type": "game_start", "initials": "jb" }
{ "type": "pop_shown", "id": 3 }
{ "type": "bonk", "id": 3, "ms": 287 }
{ "type": "tap", "x": 1.2, "z": -0.4 }
{ "type": "game_quit" }
```

Initials are uppercased, stripped to A-Z and cut to three letters; blank or
blocklisted initials become `BOO`. A message with missing or mistyped
fields gets `{"type":"error","reason":"invalid_payload"}`.

### Server to client

```json
{ "type": "game_started", "sessionId": "<uuid>", "initials": "JB",
  "countdownMs": 3000, "durationMs": 30000, "upMs": 1500,
  "pops": [ { "id": 0, "atMs": 500, "grave": 4, "kind": "zombie" }, ... ] }
{ "type": "game_start_denied", "reason": "already_active", "initials": "AB", "endsInMs": 12000 }
{ "type": "score_update", "id": 3, "verdict": "bonk", "points": 748, "score": 2310 }
{ "type": "game_ended", "initials": "JB", "score": 3140, "avgMs": 301, "rank": 4, "scoreId": 42 }
{ "type": "error", "reason": "unknown_type" }
```

`atMs` counts from the end of the countdown. `grave` is 0-8 in a 3x3 grid
(row-major, back row first). `kind` is `zombie`, `golden`, `grandma`, `cat`
or `kevin`; the last three are decoys.

### Schedule

16 pops per game: 13 zombies (one golden) and three decoys with at least
one Grandma. The first three pops are never decoys and the first is always
a plain zombie. Pops start at 500ms, are at least 1000ms apart, and every
pop is down by 30s. Two characters up at once never share a grave.

### Scoring

| Verdict    | When                                   | Points |
| ---------- | -------------------------------------- | ------ |
| `bonk`     | zombie, 100ms <= ms <= 1500ms          | 100 + 900 x (1500 - ms) / 1500, golden x2 |
| `decoy`    | Grandma, the cat or Kevin, any speed   | -500   |
| `too_fast` | ms < 100 (a mashed or scripted tap)    | 0      |
| `escaped`  | ms > 1500 (it already went back down)  | 0      |

The running total never drops below 0. Each pop can be bonked once, and
only after the phone reported drawing it (`pop_shown`). `avgMs` averages
real bonks only. A game where nothing popped is not saved. A disconnect
or `game_quit` ends the game immediately and the score still counts. The
phone skips the results screen when it quits during the countdown, since
nothing popped and nothing is saved.

## Increment flow

```
Client → POST /api/counter {"year":2026}
        ↓ CounterService saves the event
        ↓ AFTER_COMMIT event listener fires
        ↓ SseBroadcaster re-reads the total
        ↓ every EventSource gets {"type":"increment","total":42,...}
        ↓ clients update the big number
```
