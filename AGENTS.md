# AGENTS.md

Project: Halloween Candy Counter (2026 rewrite)

Description of the system, its architecture, and how to navigate the
codebase. This file is the canonical location for agent instructions. Read
it fully before working on this repository.

---

## Commands

| Task                     | Command                                                     |
| ------------------------ | ----------------------------------------------------------- |
| Backend (H2, port 8080)  | `mvn spring-boot:run -Dspring-boot.run.profiles=local`      |
| Frontend dev (port 5173) | `npm run dev`                                                |
| Backend tests            | `mvn test`                                                   |
| Frontend tests           | `npm run test:run`                                           |
| Lint                     | `npm run lint`                                               |
| Typecheck + build        | `npm run build`                                              |
| Local prod-like bundle   | `npm run bundle`                                             |
| Live tokens (prod)       | `make tokens`                                                |
| Wipe a year's test data  | `make reset-year YEAR=2026` (prod, asks first)               |
| Regenerate QR codes      | `npm run qr <publicUrl> <adminToken> <settingsToken>`        |
| Deploy / smoke / rollback| `make deploy` · `make smoke` · `make rollback TAG=x`         |

Running one test:

```bash
mvn test -Dtest=GameServiceTest                     # one class
mvn test -Dtest='GameServiceTest#secondStartGameDenied'  # one method

npx vitest run src/test/theme.test.ts               # one file
npx vitest run -t 'renders all three nav tabs'      # one test by name
npx vitest                                           # watch mode
```

> A misspelled `-Dtest=` selector reports `Tests run: 0` **and**
> `BUILD SUCCESS`. Maven does not fail on a selector that matches nothing,
> so check the count, not the exit code. `#setUp` matches nothing either -
> only `@Test` methods are selectable.

---

## 1. Why This Repo Is The Way It Is

The original app was a Vite/React/TS frontend plus a small Node `server.js`
handling increment/state/SSE. It was rewritten as a Spring Boot application:

1. Spring Boot backend (REST + SSE + WebSocket + Flyway)
2. Admin token auth via query param or Bearer header, with runtime rotation
3. Database: `events` (all activity), `settings` (year config), `tokens`
4. Frontend rebuilt: SSE client, Recharts stats, and Graveyard Bonk - a
   three.js reaction game played on phones and broadcast on the garage door
5. Dockerfile: multi-stage (Vite build → Maven build → JRE runtime)
6. A shared CSS token + primitives layer used by React *and* the static
   admin pages

`server.js` still sits in the repo root but is **legacy and unused** - the
Spring Boot app serves everything. Do not extend it, do not integrate it,
do not read it for behaviour. It is kept only as a historical reference and
is a candidate for deletion.

---

## 2. System Architecture

```
[GARAGE PROJECTOR LAPTOP - HDMI browser]     [PHONES: viewer/admin/game]
                └──────────────┬─────────────────────┘
                     HTTPS/WSS to the public domain
              (halloween-counter.jonathanbell.ca, QR codes)
                               ↓
      [FRANCESCO - shared Ubuntu box, one compose project at /opt/stack]
        [stack-caddy :80/:443]  owns TLS for every site on the box
                ↓
        [stack-halloween :8080, internal network only]
            ├── SSE  (/api/events)          → counter/state
            ├── REST (/api/counter etc.)    → admin mutations
            ├── REST to public effects/vote/stats
            └── WebSocket (/ws/game)        → Graveyard Bonk (phone)
                ↓
        [host PostgreSQL 16, 172.30.0.1:6542, `candy` DB]
            ├── events   (increment/vote/effects/game_score, timestamped)
            ├── settings (year, initialCandy, countAdjustment)
            └── tokens   (runtime-rotated admin/settings tokens)
```

The topology is one shared cloud server with no Tailscale; this repo ships
only the image, and the garage laptop is a plain browser client. The box's
own runtime config (compose service, Caddy site block, secrets) is
maintained on the box, not here. Deploys: `Makefile` + `docs/deployment.md`,
which is the authority for the server's shape.

Browser surfaces:

- **Projector** - `/?projection&token=<admin>` on the garage laptop.
  `?projection` hides all chrome; the token is what makes the spacebar
  shortcut able to increment.
- **Phone/viewer** - `/` (counter, vote, effects), `/game` (Graveyard Bonk),
  `/stats` (charts + Hall of Fame). Each carries a small pill nav above the
  title linking to the other two; `/` also sells them with hero cards.
- **Admin** - `/remote.html?token=<admin>` (big increment button),
  `/settings.html?token=<settings>` (candy supply + total override). These
  two are static HTML served straight from `public/`, not part of the React
  bundle, and they have their own pill nav. The remote also shows a
  token-free QR to `/` for visitors' phones.

The frontend bundles into Spring Boot's static resources
(`src/main/resources/static`) and is served directly by Spring Boot. That
directory is **build output, not source**: it is gitignored, and the
Dockerfile builds it in a `node` stage that hands `dist` to the Maven
stage. Locally, `npm run bundle` fills it for a prod-like run on :8080.
Vite's `npm run dev` serves the same app during frontend iteration - but
the backend must be running on 8080 for any API call to work.

---

## 3. Module Layout (Java)

```
com.halloween.candy_counter
├── CandyCounterApplication        Main entry point
├── config
│   ├── SpaRoutingConfig           Forwards React routes to index.html
│   └── V6_1__DropStaleH2TypeCheck Local-profile Flyway fix (see section 5)
├── controller
│   ├── CounterController          POST /api/counter, GET /api/state
│   ├── SettingsController         GET/POST /api/settings (settings token)
│   ├── TokenController            POST /api/tokens/rotate (settings token)
│   ├── EffectsController          POST /api/effects/lightning,candy-rain
│   ├── VoteController             POST /api/vote, GET /api/vote/options
│   ├── StatsController            GET /api/stats (public chart data)
│   └── LeaderboardController      GET /api/leaderboard (public)
├── service
│   ├── CounterService             Increments + votes + state aggregation
│   ├── EffectService              Lightning / candy-rain cooldowns (350 /
│   │                              250ms), refused while a game runs
│   ├── SettingsService            Year settings, adjustment, candy options
│   ├── TokenService               Resolves tokens (DB row → env fallback),
│   │                              generates rotations
│   ├── SseBroadcaster             SSE subscribe + counter/game broadcast
│   ├── GameService                Graveyard Bonk referee: one game at a
│   │                              time, judges bonks, relays to SSE
│   └── LeaderboardService         Saves finished games, ranks, top N
├── repository
│   ├── EventRepository            JPA on `events` (custom aggregations)
│   ├── SettingsRepository         JPA on `settings`
│   └── TokenRepository            JPA on `tokens`
├── model
│   ├── Event                      JPA entity for events table
│   ├── Settings                   JPA entity for settings table
│   └── Token                      JPA entity for tokens table
├── domain
│   ├── EventMessage               type/year/total/timestamp of SSE
│   ├── CandyOption                one favorite-candy choice (id/label/image)
│   ├── GameStatusEvent            game on/off, player initials, time left
│   ├── GameSchedule               the 16 pops of one game (who, when, where)
│   ├── BonkScore                  points per bonk (the only copy)
│   └── Initials                   A-Z, 3 letters, rude -> BOO
├── websocket
│   ├── WebSocketConfig            registers /ws/game handler
│   └── GameWebSocketHandler       JSON protocol: start, shown, bonk, tap,
│                                  quit
└── security
    └── AdminTokenFilter           token check for /api/counter,
                                   /api/settings, /api/tokens
```

> **Adding a React route? Edit `SpaRoutingConfig` too.** It forwards only
> `/game` and `/stats` to `index.html` - deliberately, not as a catch-all.
> A new route works under `npm run dev` (Vite serves the SPA for anything)
> and returns 404 in production until it is added there.

Frontend (`src/`):

```
src/
├── App.tsx                        Cheap path router + overlay logic
├── theme.ts                       Design tokens for JS consumers (Recharts,
│                                  three.js materials). Mirrors
│                                  public/theme.css; a test guards parity.
├── hooks
│   ├── useSSE.ts                  EventSource wrapper w/ listener registry
│   ├── useCounter.ts              Server-synced candy count
│   ├── useStats.ts                Server statistics (minute histogram math)
│   ├── useVote.ts                 Candy options + one changeable vote/phone
│   ├── useGame.ts                 Phone's WebSocket -> phoneReducer
│   ├── useGameFeed.ts             Game as seen over SSE -> feedReducer
│   └── useProjectionMode.ts       ?projection flag → hide chrome
├── components
│   ├── PageShell.tsx              Shared chrome: pill nav, title, rule
│   ├── Counter.tsx, CandyProgress.tsx, StatsDisplay.tsx   The classic visuals
│   ├── LightningCanvas.tsx, DroolingRain.tsx    Effects (+ aimed strikes,
│   │                              candy bursts, calm weather for games)
│   ├── Game.tsx                   /game: initials, lockout, play, results
│   ├── GameBroadcast.tsx          garage door during a game (lazy chunk)
│   ├── LiveBanner.tsx             viewer phones: who is playing
│   ├── ViewerControls.tsx         game/stats hero cards, effects, vote
│   ├── CandyVote.tsx              candy vote grid, shared with StatsPage
│   ├── StatsPage.tsx              Recharts graphs for last-year/current-year
│   └── HallOfFame.tsx             leaderboard card, #score-<id> highlight
└── game                           Graveyard Bonk. Only lazy pages import the
    │                              three.js files, so the counter never loads it
    ├── protocol.ts                WS + SSE message types (mirrors docs/api.md)
    ├── phoneReducer.ts            phone state machine (pure)
    ├── feedReducer.ts             garage door phases from SSE (pure)
    ├── titles.ts, labels.ts       end-of-game titles, decoy banners, labels
    ├── graves.ts                  3x3 grid positions shared by both cameras
    ├── sfx.ts                     Web Audio synth sounds, fail silently
    ├── GraveyardScene.tsx         R3F canvas: cameras, lights, hitboxes
    ├── Scenery.tsx, models.ts     Kenney models (public/models/graveyard)
    ├── Character.tsx              the cast, built in code, and animations
    ├── Effects3D.tsx              candy bursts, slime splats
    ├── CastLineup.tsx             start screen: who to bonk, tap to practice
    └── PhoneGame.tsx              phone play view: schedule, taps, HUD
```

### Styling: one system, two consumers

There is no CSS framework. Two files in `public/` are the whole system, and
both are linked from `index.html` **and** from every static admin page -
that shared link is the point, and it is what keeps the React app and the
hand-written admin tools from drifting apart again:

```
public/
├── theme.css        ALL design tokens + the Digital-7 @font-face
├── primitives.css   .page-shell .page-title .rule .card .btn* .field .pill
│                    .dot .readout .message .page-nav .page-end
├── admin.js         Admin pill nav + per-tool sessionStorage token cache
└── models/graveyard Kenney Graveyard Kit 5.0 GLBs (CC0, License.txt)
```

Rules:

- **Never hardcode a colour, radius, spacing step or font size.** Use the
  tokens. `src/test/theme.test.ts` fails if `src/theme.ts` and
  `public/theme.css` disagree. That includes the 3D scene: three.js
  materials read the `scene*` colours from `src/theme.ts`, mirrored as
  `--color-scene-*`.
- **`.projection` scopes the garage door.** Phone-first is the default rule;
  the projector's viewport-unit sizing lives under `.app.projection`, e.g.
  `.digit { font-size: clamp(72px, 24vw, 110px) }` with
  `.app.projection .digit { font-size: 21vh }` inside a 20vh well. Adding an
  unscoped `vh` rule is how you break the phone layout.
- **The projection page renders no chrome.** `App.tsx` returns the bare page
  when `useProjectionMode()` is true and wraps it in `PageShell` otherwise.
- **Navigation is the `.page-nav` pill row** above the title, linking to
  the other pages only. `/` also sells the game and stats with hero cards
  in `ViewerControls`. The admin tools have their own Remote / Settings
  pair rendered by `admin.js`.
- **The counter's increment glitch lives in `Counter.css`**, split across
  five keyframes (`crt-blank`, `crt-split-red`/`-cyan`, `crt-scan`,
  `crt-surge`) plus a whole-display `crt-sag`. `Counter.tsx` contributes only
  randomness: it rolls a handful of custom properties per well per increment
  so the three digits read as three screens rather than one animation played
  three times. See "Counter increment animation" below.
- Dark ink on `--color-accent` (6.98:1), never white (2.82:1).

`public/fonts/digital-7.ttf` is freeware licensed for **home use only**
(`public/fonts/DIGITAL-7-LICENSE.txt`). The app is served from a public
domain, which is arguably outside that grant. Swapping in a licensed or
open seven-segment face is the clean fix.

### Counter increment animation

Every increment runs the same five-stage CRT hit in all three wells at once.
`Counter.tsx` re-rolls the multipliers per well per increment, so the three
screens hit together and then diverge:

```
        0ms                                                      620ms
well A  |blank|--split--|                                             |
        |========== surge ==========|
              |------ scan ------|
well B    |blank....|----split----|          <- own jitter, own scales
          |============= surge =============|
                    |-------- scan --------|
well C  |bl|-split-|
        |====== surge ======|
        |sag|  (once, across the whole readout)
```

| Base clock (`.counter-display`) | Per-well multiplier (inline, `Counter.tsx`) |
| --- | --- |
| `--glitch-blank: 40ms`  | `--blank-scale` 0.6-1.5 |
| `--glitch-split: 150ms` | `--split-scale` 0.45-1.6, `--split-dir` ±1 |
| `--glitch-scan: 220ms`  | `--scan-scale` 0.7-1.45 |
| `--glitch-surge: 420ms` | `--surge-scale` 0.75-1.3 |
| -                       | `--glitch-jitter` 0-55ms, delays that well's whole chain |

Two derived properties keep the keyframes readable rather than nesting
`calc()` five deep: `--split-x` on `.digit` (offset x magnitude x direction)
and `--glitch-recover` on `.digit-container` (that well's own black frame
ending, which is when its split and sweep start).

The red/cyan channels are `.digit::before` / `::after` drawing
`content: attr(data-digit)` with `mix-blend-mode: screen`, not an animated
`text-shadow` - the digit already carries a two-layer glow on phones and a
four-layer bloom on the projector, and keyframes would have to restate both
stacks in full.

---

## 4. API Surface

**`docs/api.md` is the authority** - full payloads, error cases, the SSE
message catalogue, the WebSocket protocol, the schedule and scoring. Do not
restate it here; this section exists only to orient.

```
Public   GET  /api/state          snapshot: count, candy, who is playing
         GET  /api/events         SSE subscription (counter + game + effects)
         GET  /api/stats          totals, votes, histogram
         GET  /api/leaderboard    Graveyard Bonk scores for a year
         POST /api/vote           favourite-candy vote
         GET  /api/vote/options   the year's candy choices
         POST /api/effects/lightning | /api/effects/candy-rain

Admin    POST /api/counter        increment            (admin token)
         GET  /api/settings       year config          (settings token)
         POST /api/settings       year config          (settings token)
         PUT  /api/settings/candy-options  candy list  (settings token)
         POST /api/tokens/rotate  rotate a token       (settings token)

Game     WS   /ws/game            Graveyard Bonk (phone)
```

Tokens travel as `?token=...` or `Authorization: Bearer <token>`.
`AdminTokenFilter` gates `/api/counter`, `/api/settings` and `/api/tokens`;
`/api/settings` and `/api/tokens` require the **settings** token, which is
the higher privilege of the two. `/api/events` is deliberately unprotected -
every viewer subscribes to it.

`TokenService` resolves each token as **`tokens` table row → env var
fallback**, per request. Rotating writes a DB row that wins from then on;
deleting the row reverts to the env var with no restart. Rotation
invalidates printed QR codes - see `docs/configuration.md`.

---

## 5. Data Model

**The migration files in `src/main/resources/db/migration` are the
authority** for column names, types and constraints. Read them rather than
trusting a copy here.

```
V1__initial_schema.sql      events + indexes
V2__settings_table.sql      settings + seed row (2026, 300)
V3__count_adjustment.sql    count_adjustment added to settings
V4__seed_2025_data.sql      2025 comparison row (346 total) + one event
V5__tokens_table.sql        tokens table for runtime rotation
V6__game_score_type.sql     adds 'game_score' to the events type constraint
V7__game_score_initials.sql initials + avg_ms on events (leaderboard)
V8__vote_voter_id.sql       voter_id on events (latest vote per phone wins)
V9__candy_options.sql       candy_options JSON text on settings (vote choices)
```

Local H2 also runs `V6_1__DropStaleH2TypeCheck`, a Java migration bean that
only exists in the `local` profile. V1's inline type check gets a generated
name on H2, so V6's `DROP CONSTRAINT IF EXISTS events_type_check` misses it
there and `game_score` inserts failed locally. Postgres never needs it.

Three invariants that are easy to break and expensive to discover:

- **`currentTotal = COUNT(increment events) + settings.count_adjustment`**
  (`EventRepository.countIncrementsByYear`). Overrides from "Set Total
  Count" are written as an adjustment, never by deleting events, so history
  survives. Any new total calculation must include the adjustment.
- **The `events.type` CHECK constraint is the single source of valid event
  types.** It currently allows `increment`, `effect_lightning`,
  `effect_candy_rain`, `vote`, `game_score`. Adding a type means a new
  Flyway migration - `V6` exists precisely because `game_score` was added
  after the fact.
- **`"year"` and `"timestamp"` are quoted identifiers** everywhere - in the
  migrations, the JPA entities and the indexes. They are reserved words and
  H2 and Postgres disagree about them. Unquoting one breaks local dev or
  production, usually not both at once.

Timestamps are stored UTC; clients convert for display. The 2025 comparison
row uses a synthetic 6pm PDT timestamp so it lands in one histogram bucket.

---

## 6. Testing

Two suites. Both must pass before committing. Runners, including
single-test selection, are in **Commands** above.

**Backend** - `mvn test` (63 tests, mocked only, no Spring context boot):

```
src/test/java/com/halloween/candy_counter
├── domain
│   ├── GameScheduleTest        schedule rules, checked over 300 seeds
│   ├── BonkScoreTest           points per verdict
│   └── InitialsTest            cleanup + BOO
├── service
│   ├── CounterServiceTest      increment/vote aggregation + getState
│   ├── EffectServiceTest       cooldowns, refused during a game
│   ├── SettingsServiceTest     update paths, candy option rules
│   ├── GameServiceTest         start/deny, relays, judging, persistence
│   └── LeaderboardServiceTest  record, rank, top N
└── security
    └── AdminTokenFilterTest    token accept/reject per endpoint
```

**Frontend** - `npm run test:run` (95 tests, vitest + jsdom; config in
`vite.config.ts`, setup in `src/test/setup.ts`):

```
src/test
├── theme.test.ts          src/theme.ts ↔ public/theme.css token parity
├── PageShell.test.tsx     nav links per page, title/children
├── Counter.test.tsx       glitch class, per-well rolls, data-digit
├── Game.test.tsx          cast lineup, initials, lockout, play, results
├── phoneReducer.test.ts   phone game state machine
├── PhoneGame.test.tsx     two-tap quit button
├── feedReducer.test.ts    garage door phases, replay target
├── titles.test.ts         speed titles and decoy roasts
├── HallOfFame.test.tsx    ranks, ties, #score-<id> highlight
├── DroolingRain.test.tsx  one emoji per visitor, 200 cap
└── useStats.test.ts       5-minute handout rate buckets
```

jsdom has no WebGL: component tests stub the three.js views
(`PhoneGame`, `GameBroadcast`, `CastLineup`); the game logic lives in the
pure reducers so it is tested without them.

Integration tests are absent by choice. Add them carefully: `GameService`
holds an end timer on an executor, so any test that starts a game must end
it (or call `shutdown()`) or the timer outlives the test.

---

## 7. Local Development

Terminal A: `mvn spring-boot:run -Dspring-boot.run.profiles=local`
(H2 in-memory; data is empty on every restart)

Terminal B: `npm run dev` (Vite dev server on :5173)

Vite proxies `/api` and `/ws` to `http://localhost:8080` (see
`vite.config.ts`), so the backend must be running for API calls to work.
To exercise what production actually serves, run `npm run bundle` and use
Spring Boot's static bundle on :8080 instead. A fresh clone has no bundle
at all, so :8080 serves nothing until that runs.

Dev tokens (from `application-local.yml`): `dev-admin-token` /
`dev-settings-token`.

---

## 8. Docker deploy

```
Dockerfile 3-stage:
  1. node:24-alpine                   → npm ci + vite build → dist
  2. maven:3.9.9-eclipse-temurin-21   → dist → resources/static, then jar
  3. eclipse-temurin:21-jre           → runtime only
```

Stage 1 is why the bundle is not in git. `.dockerignore` excludes
`src/main/resources/static` from the build context so a local
`npm run bundle` copy cannot shadow the freshly built one (`COPY` merges
into a directory, it does not replace it).

Production runs on `francesco`, a shared box whose own compose project
(`/opt/stack`) defines the `halloween` service, the Caddy site block, and
the secrets (`HALLOWEEN_*` in `/opt/stack/.env`). This repo ships only the
image, tagged by git sha and released via the `Makefile`: `make deploy`
(amd64 build → `docker save | ssh | docker load` → re-point the box's
compose tag → restart → verify), `make smoke` for a local run against real
Postgres, `make rollback TAG=x`, and `make tokens` to print the live
admin/settings tokens (DB row, else env) for baking QR codes.

**Never resurrect a repo-local compose/Caddy/Postgres stack for
production** - the box already provides all three, and a second copy fights
the one that is actually serving traffic.

Day-to-day loop, the server's shape, and failure modes: `docs/deployment.md`.

---

## 9. Design Decisions

1. **Spring Boot over Node.** Wanted uniform dependency injection, a single
   runnable JAR, the official Postgres driver, and first-party SSE and
   WebSocket support. Node could have done it, but the rewrite was the
   point: add Java and retire `server.js` in one release.
2. **SSE for the counter.** Server push suits a projection that must update
   the instant someone taps. Spring's `SseEmitter` pairs directly with the
   browser `EventSource` API, and it survives a reverse proxy without
   special configuration.
3. **WebSocket for the game.** The game needs client→server taps at play
   speed and server→client spawns on the same connection. SSE is one-way,
   so it cannot carry the taps.
4. **Both transports funnel through `SseBroadcaster`** using typed
   `EventMessage` / `GameStatusEvent` payloads, so the projection can render
   game visuals over SSE without holding a WebSocket of its own.
5. **Token-based admin, not OAuth.** Two shared secrets printed as QR codes
   is the right weight for a one-night toy. Tokens can arrive as a query
   param (so a QR code carries one) or a Bearer header. The `tokens` table
   was added so a leaked token can be rotated on the night without a
   redeploy.
6. **The events table records everything.** Every increment, vote, effect
   and finished game score is a row. That keeps statistics meaningful and
   avoids a second reporting path, at the cost of a table that grows with
   activity - which for one night a year is free.
7. **`count_adjustment` instead of editing events.** Correcting the total
   writes one integer in `settings` rather than deleting rows, so a
   miscount never destroys the per-minute histogram.
8. **H2 for local dev** (`application-local.yml`, `MODE=PostgreSQL`), so
   nobody needs Postgres installed to work on the frontend. `make smoke` is
   the counterweight - it boots the real image against real Postgres, and
   it is what caught Flyway's missing Postgres module.
9. **One game session at a time.** Two simultaneous games would both drive
   the same projection, which looks broken. `GameService` keeps a single
   active session; a second `game_start` is answered with
   `game_start_denied` rather than being silently queued.
10. **Games auto-end on the server's timer** (3s countdown + 30s + 1s
    grace for the last bonk), so a phone that walks out of range or closes
    the tab cannot strand the projection in game mode.
11. **Recharts for the stats charts only.** It brings its own SVG styling,
    which is fine inside a card but not something to spread further; the
    rest of the UI is hand-written CSS against the token sheet.
12. **Quoted `"year"` / `"timestamp"`** in migrations, entities and indexes,
    because both are reserved words and H2 and Postgres handle them
    differently.
13. **`game_started` / `game_start_denied` over the WebSocket**, not an HTTP
    pre-check, so the phone learns it was denied on the same connection it
    will play on - no race between the check and the start.
14. **One CSS token sheet in `public/`, linked by both worlds.** The React
    app and the three static admin pages share `theme.css` and
    `primitives.css` literally. An earlier arrangement mirrored the tokens
    into `src/` and the two copies drifted until the admin pages were white
    cards on a dark site.
15. **The counter increment is a CRT hit, not a flip.** The original
    `flipAnimation` rotated each digit like a split-flap board - a physical
    metaphor bolted onto a seven-segment readout. It was replaced with a
    blackout / channel-split / scanline / surge chain on `steps()` timing,
    because the material is a screen. The per-well randomness exists for the
    same reason: three identical animations read as one prop, three
    different ones read as three screens.
16. **Graveyard Bonk times reactions on the phone.** The server sends the
    whole schedule up front and the phone measures each reaction from the
    first frame a character is drawn to the touch's own timestamp. Over the
    network that would add 100-300ms of jitter to a 300ms reaction. The
    cost is trust: a scripted client could lie, and the server only sanity
    checks (a floor of 100ms, one bonk per drawn pop). Fine for a toy.
17. **The garage door is a broadcast, not a mirror.** The phone narrates
    (`pop_shown`, `bonk`, `tap`), the server relays over SSE, and the door
    redraws the same scene from its own camera. Everything lands about the
    same delay late, which spectators cannot see. Streaming the phone's
    screen would be heavy and laggier.
18. **three.js only in the game chunks.** `Game` and `GameBroadcast` are
    lazy-loaded and are the only importers of `src/game/*`'s 3D files, so
    the counter and stats pages never download three.js. The projector
    prefetches the chunk while idle so the first game starts instantly.

---

## 10. Things Not to Do

- **Don't change the `events` or `settings` schema without a Flyway
  migration.** Existing databases must migrate; there is real 2025 and 2026
  data on the server.
- **Don't compute a total without `count_adjustment`.** Check the number
  against `GET /api/state` before trusting it.
- **Don't hardcode a token in source.** Tokens come from `TokenService`
  (DB row, then env var) on the server, and from the URL on the client.
- **Don't put a token-bearing QR code (or anything else with a token) in
  `public/`.** The repo is public and the app serves that folder to anyone.
  `npm run qr` writes the admin/settings PNGs to gitignored `qr-print/` for
  printing; an earlier `/admin-qr.html` served them and was deleted.
- **Don't add a React route without adding it to `SpaRoutingConfig`** - it
  will work in dev and 404 in production.
- **Don't write an unscoped `vh` rule.** Viewport units belong under
  `.app.projection`; anything unscoped hits phones too.
- **Don't hardcode a colour, radius or font size.** Use the tokens in
  `public/theme.css`.
- **Don't remove or replace the `CopyOnWriteArrayList` backing the SSE
  emitters.** Broadcasting and removing dead emitters happen on different
  threads; a plain list will throw
  `ConcurrentModificationException` mid-broadcast and drop every screen.
- **Don't move the game's end timer into `@Scheduled` tasks.** `GameService`
  stores each game's end timer and cancels it when the game ends; a shared
  schedule cannot be cancelled per game and would end the next one early.
- **Don't measure reaction times on the server.** Network lag would be
  most of the number. See design decision 16.
- **Don't import three.js (or `src/game`'s 3D files) from the main bundle.**
  Only the lazy `Game` and `GameBroadcast` pages may; pure files such as
  `protocol.ts` and the reducers are fine anywhere.
- **Don't commit `src/main/resources/static`.** It is build output. The
  image's frontend stage produces it and `.dockerignore` keeps any local
  copy out of the build context; a `git add -f` puts the repo back to
  shipping a hand-refreshed bundle.
- **Don't give the counter's glitch `animation-fill-mode: both`.** The
  backwards fill applies the 0% keyframe through the delay, so every well
  lights on frame 1 and the split channels are already on during the black
  frame. `forwards` is the only correct fill there.
- **Don't change a `--glitch-*` duration without checking `ANIMATION_MS`**
  in `src/hooks/useCounter.ts`. It is the timeout that strips `.glitching`,
  and it must outlast the unluckiest roll (`--glitch-surge` at its top
  `--surge-scale`, after the largest `--glitch-jitter`) or that well's
  animation is cut off mid-flight.
- **Don't extend `server.js`.** It is dead code.

---

## 11. Getting Started Checklist for a New Coding Agent

- [ ] Read this file, then `docs/api.md` for anything API-shaped
- [ ] Terminal A: `mvn spring-boot:run -Dspring-boot.run.profiles=local`
- [ ] Terminal B: `npm run dev`
- [ ] Sanity check: `curl 'http://localhost:8080/api/state?year=2026'`
- [ ] Make the change; add or update a test alongside it
- [ ] `mvn test` and `npm run test:run` - both must be green
- [ ] `npm run lint` and `npm run build`

Nothing to commit for the bundle: `src/main/resources/static` is gitignored
and the image builds it. `npm run bundle` is only for serving the frontend
from Spring Boot locally; it deletes the directory before copying `dist`
in, so stale hashed assets never accumulate.
