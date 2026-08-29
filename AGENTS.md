# AGENTS.md

Project: Halloween Candy Counter (2026 rewrite)

Description of the system, its architecture, and how to navigate the codebase. This file is the canonical location for agent-instructions. Read it fully before working on this repository.

---

## 1. Session History (Why This Repo Is The Way It Is)

The initial repo had: Vite/React/TS frontend + a small Node `server.js`
handling increment/state/SSE. In a prior design session (see
`docs/PRD_2026_HALLOWEEN.md`), the user and an interviewer agent agreed
on a full Spring Boot rewrite. This session implemented that PRD:

1. Spring Boot backend (REST + SSE + WebSocket + Flyway)
2. Admin token auth via query param or Bearer header
3. Database: events table (all activity) + settings table (year config)
4. Frontend rebuilt: SSE client, WebSocket game client, Recharts stats
5. Dockerfile: 2-stage (Maven build → JRE runtime)
6. Unit tests for services + security filter

The Node `server.js` still exists but is legacy — do not extend it.
Do not attempt to integrate it. Use Spring Boot (Maven) only.

---

## 2. System Architecture

```
[GARAGE PROJECTOR LAPTOP - HDMI browser]
                ↓  (Tailscale VPN / Tailscale Funnel URL)
      [SPRING BOOT APP SERVER (port 8080)]
            ├── SSE  (/api/events)          → counter/state
            ├── REST (/api/counter etc.)    → admin mutations
            ├── REST to public effects/vote/stats
            └── WebSocket (/ws/game)        → Whack-a-Zombie game
                ↓
      [MANAGED POSTGRES (cloud)]
            ├── events   (increment/vote/effects, timestamped)
            └── settings (year, initialCandy, countAdjustment)
```

Two browsers machines:
- **Projector** = shows `/` with `?projection` flag to hide viewer controls
- **Phone/Viewer** = user opens `/`, taps buttons, uses `/game` controller
- **Admin** = `/remote.html?token=...` (increment), `/settings.html?token=...`

Frontend bundles into Spring Boot's static resources (`/static/*`) and
is served directly by Spring Boot. Vite's `npm run dev` serves similarly during frontend iteration — BUT the backend must run at 8080 for those to work with the API.

---

## 3. Module Layout (Java)

```
com.halloween.candy_counter
├── CandyCounterApplication        Main entry point
├── controller
│   ├── CounterController          POST /api/counter (increment),
│   │                              GET /api/state (public)
│   ├── SettingsController         GET/POST /api/settings (token)
│   ├── EffectsController          POST /api/effects/lightning,candy-rain
│   ├── VoteController             POST /api/vote (public)
│   └── StatsController            GET /api/stats (public chart data)
├── service
│   ├── CounterService             Increments + votes + effects + state aggregation
│   ├── SettingsService            Create/update year settings, adjustment
│   ├── SseBroadcaster             SSE subscribe + counter/game broadcast
│   └── GameService                Whack-a-Zombie: spawn/miss/hit resolution
├── repository
│   ├── EventRepository            JPA on `events` (custom aggregations)
│   └── SettingsRepository         JPA on `settings`
├── model
│   ├── Event                      JPA entity for events table
│   └── Settings                   JPA entity for settings table
├── domain
│   ├── EventMessage               type/year/total/timestamp of SSE
│   └── GameStatusEvent            game mode toggle, sessionId
├── websocket
│   ├── WebSocketConfig            registers /ws/game handler
│   └── GameWebSocketHandler       text-based JSON protocol for game
└── security
    └── AdminTokenFilter           token check for /api/counter, /api/settings
```

Frontend (`src/`):

```
src/
├── App.tsx                        Cheap path router + overlay logic
├── hooks
│   ├── useSSE.ts                  EventSource wrapper w/ listener registry
│   ├── useCounter.ts              Server-synced candy count
│   ├── useStats.ts                Server-statistics (minute histogram math)
│   ├── useGame.ts                 WebSocket-WS client (client <-> server)
│   ├── useProjectionMode.ts       ?projection flag → hide controls
├── components
│   ├── Counter.tsx, CandyProgress.tsx, StatsDisplay.tsx, ZombieHorde.tsx    The classic Halloween visuals
│   ├── LightningCanvas.tsx, DroolingRain.tsx    Random effects timers
│   ├── Game.tsx                   phone WebSocket controller UI
│   ├── GameOverlay.tsx            projection visual layer during game
│   ├── ViewerControls.tsx         vote + effects + game link
│   └── StatsPage.tsx              Recharts graphs for last-year/current-year
```

---

## 4. API Surface

### Admin (token-required)

```
POST /api/counter {year: 2026}                              → increment
GET  /api/settings?year=2026        (+token)                 → fetch settings
POST /api/settings {year, initialCandyCount?, currentTotal?} → update config
```

Tokens arrive via `?token=...` or `Authorization: Bearer <token>`.
Both admin & settings tokens exist; AdminTokenFilter routes them.

### Public

```
GET  /api/state?year=2026                              → snapshot count
GET  /api/events                                       → SSE subscription
POST /api/effects/lightning?year=2026                  → lightning visual
POST /api/effects/candy-rain?year=2026                 → candy rain
POST /api/vote {year, candyType}                        → vote for favorite candy
GET  /api/stats?year=2026                              → total + vote + histogram
```

`/api/events` is NOT token-protected (any viewer taps it). Conventional subscription
via EventSource; server broadcasts `EventMessage` and game-related payloads.

### WebSocket

```
/ws/game    TextWebSocketHandler for Whack-a-Zombie

Client → Server:
  {"type":"game_start"}      → try to open session
  {"type":"zombie_hit"}      → default to half-empty zombieId (-1 score)
  {"type":"zombie_hit","zombieId":"<long>"} → score +/-1 
  {"type":"game_end"}        → close early

Server → Client (JSON):
  {"type":"game_started","sessionId":"..."}
  {"type":"game_start_denied","reason":"already_active"}
  {"type":"zombie_spawned","zombieId":"...","direction":0|1}
  {"type":"zombie_missed","zombieId":"..."}
  {"type":"game_ended","score":N}
```

The server also broadcasts zombies + game status over SSE so the projection
can render visuals without holding a WS connection of its own.

---

## 5. Data Model

### events (V1)

```
id           BIGSERIAL PRIMARY KEY
"year"       INTEGER  (quoted, reserved word handling)
"timestamp"  TIMESTAMP WITH TIME ZONE  (quoted)
type         VARCHAR(20) CHECK ( 'increment' | 'effect_lightning' |
                                  'effect_candy_rain' | 'vote' )
candy_type   VARCHAR(50)    (vote-only, e.g. "snickers")
game_session_id UUID         (or unused)
score        INTEGER
```

Dates are stored UTC; clients convert to their locale/timezone on display.
The 2025 comparison data uses a synthesized timestamp of 6pm PDT on the same
date (see StatsPage.tsx).

The CHECK constraint is the implicit single source of valid event types;
use it consistently.

### settings (V2 + V3)

```
id                    BIGSERIAL PRIMARY KEY
"year"                INTEGER UNIQUE (quoted)
initial_candy_count   INTEGER DEFAULT 300
active_game_session   UUID
count_adjustment      INTEGER DEFAULT 0   (V3)
updated_at            TIMESTAMP WITH TIME ZONE
```

`currentTotal = SUM(events) + count_adjustment`. Adjustments set when the
admin overrides with "Set Total Count." Adjustments preserve future events
and are far safer than manually deleting events.

### Migrations

```
db/migration
├── V1__initial_schema.sql     events + indexes
├── V2__settings_table.sql     settings + seed row (2026, 300)
└── V3__count_adjustment.sql   count_adjustment added to settings
```

Year columns and timestamps are quoted identifiers ("year"/"timestamp") to
avoid collisions with reserved SQL keywords in H2 + PG.

---

## 6. Testing

```
src/test/java/com/halloween/candy_counter
├── service
│   ├── CounterServiceTest      increment/vote aggregation + havegetState
│   ├── SettingsServiceTest     update + full-update paths
│   └── GameServiceTest         start/hit/miss/end game
└── security
    └── AdminTokenFilterTest    token accept/reject per endpoint
```

Run: `mvn test`. Currently green.

The tests are mocked-only (no Spring context boot). Add Integration
tests cautiously; WebSocket defaults to random session IDs that must be
interrupted by running a checker that shuts the executor down via endGame.

---

## 7. Local Development

Terminal A: `mvn spring-boot:run -Dspring-boot.run.profiles=local`
(uses H2 in-memory DB; data is empty each restart)

Terminal B: `npm run dev` (Vite dev server on :5173)

Vite's dev server doesn't proxy /api by default; point the frontend paths
to `http://localhost:8080`. Or build the frontend (`npm run build`) + use
Spring Boot's static bundle.

Fields admin tokens for local dev: `dev-admin-token` / `dev-settings-token`
(application-local.yml).

---

## 8. Docker deploy

```
Dockerfile 2-stage:
  1. maven:3.9.9-eclipse-temurin-21 → cached dependency download
  2. eclipse-temurin:21-jre-slim      → runtime only

ENTRYPOINT ["java", "-Xms128m", ... "-Dspring.profiles.active=production", "app.jar"]
```

External integrations via environment: DATABASE_URL, DATABASE_USER,
DATABASE_PASSWORD, ADMIN_TOKEN, SETTINGS_TOKEN. Postgres lives outside the
container on a managed host (Neon/RDS/etc.) — never internalize it.

Build: `docker build -t candy-counter:latest .`
Run:  `docker run -p 8080:8080 -e DATABASE_URL=... -e ADMIN_TOKEN=... candy-counter`

---

## 9. Design Decision Highlights (for another agent)

1. **Spring Boot over Node.** Required uniform dependency injection, better
   runnable JAR, official Postgres driver, and Spring WebSocket + SSE.
   Node could do those too but this isn't consistent with the user's
   request. We add Java now and cut Express in one release.
2. **SSE over Polling.** Server-side push is better for rapid projection updates.
   It's supported natively by Spring (`SseEmitter`) and integrates with
   the EventSource browser API.
3. **WebSocket for game, SSE for counter.** The game needs client→server taps
   in real time and server events back on the phone itself ("bidirectional").
4. **Both transports end-run via a generic `EventMessage` + `GameStatusEvent`
   typed broadcast through a central `SseBroadcaster`.**
5. **Token-based admin.** Quicker than OAuth and restores remote accidental
   vote writes. Token travels via query param or header — order not
   essential. Both admin + settings tokens exist.
6. **Events table records everything.** In the schema the line is drawn to
   avoid operational CRSD pain: every "thing that happens" (increment,
   vote, lightning, rain, hit/miss values) goes into `events`. That means
   statistics are meaningful per event. The 2026 plan keeps that.
7. **count_adjustment in settings over deleting/repairing events.** Ways
   to update totals are mined into a single column in `settings` (V3
   migration) with countAdjustment. This preserved the ability to an
   adjustment while also preserving incremental fact data for real events.
8. **H2 fallback via application-local.yml for simpler local dev.**
   H2 uses quoted identifiers to avoid keyword clashes and its post-MODE
   URL is not tripped by proprietary PG defaults.
9. **Game WebSocket single session at a time.** Concurrent games cause
   gameplay illusion farcically. The deny pattern uses one global map of
   active session keyed by WebSocket SessionID with a null return on
   disallow and a broadcast to SSE subscribers when an active one passes.
10. **Auto-end game after 30s.** Server ends game when the sequence of
    spawns/protagonist's rolling client misses ZOMBIE_TTL reaches
    GAME_DURATION_MS. This avoidss stuck states in the projection UI in
    case the controller closes.
11. **Recharts for charts only.** Custom CSS styled UI needs careful theming.
    Recharts shows its own styling for bar charts; it doesn't brawl
    with Vite react styling.
12. **Quote keywords "year"/"timestamp"** in JPA entities + indexes to
    prevent H2 + Postgres collide and make schema parsing
    reproducible on Flyway.
13. **game_started / game_start_denied over HTTP GET**. So the phone
    JS package correctly identifies denial point to user.

---

## 10. Things Not to Do

- Don't vary `events` schema without touching Flyway scripts. Original
  databases must migrate.
- Don't allow `events` countComparison to omit count_adjustment from totals
  — run the projection configuration through `/api/state` before you add
  an adjustment.
- Don't turn off `(SseEmitter)` without invalidating all
  gameplay interface rendering. `CopyOnWriteArrayList` was used so
  broadcasters and removals don't conflict across two threads.
- Don't expose the increments/tokens in source, always reference
  environment variables.
- Don't couple SSE/WS performance logic into `@Scheduled` tasks;
  remember that you introduce delayed zombie misses in WebSocket worktree.

---

## 11. Getting Started Checklist for a New Coding Agent

- [ ] Read this file + docs/PRD_2026_HALLOWEEN.md once to navigation
- [ ] mvn spring-boot:run (profiles=local) on terminal A
- [ ] npm run dev on terminal B
- [ ] curl the api or run GET /api/state
- [ ] Edit here or there, verify in the PRD or in the tests
- [ ] mvn test to reverify before you commit

The frontend static bundle must be re-bundled (`npm run build` →
`cp -r dist/* src/main/resources/static/`) whenever it gets committed.
CLAUDE.md also supports Vite. Old files must be overridden in the same
rebuild step.
