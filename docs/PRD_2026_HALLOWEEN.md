# Halloween 2026 Candy Counter — Product Requirements Document

**Date:** 2025-12-01 (for deployment Aug 2026)
**Author:** Jonathan Bell
**Stakeholders:** Jonathan Bell (garage host, coder), Trick-or-treaters, neighbors, 2026 Halloween audience
**Target:** Halloween night 2026, projected to garage door, publicly accessible via QR code

---

## 1. Vision & Goals

`High-visibility live candy counter` on the garage door with:

- **Live count** of candies handed out (min-max progress bar, count, basic stats)
- **User-scannable QR codes** for viewer/admin interfaces
- **Authenticated admin interface** for candy count recovery (toggle + override)
- **Real-time charting** of candy handout rate (by minute)
- **Vote for favorite candy** (opt-in, per device)
- **Views of 2025 historical data** as a single total placed at 6pm PDT on the graph (synthetic timestamp)
- **Playable game** — "Whack-a-zombie" — via WebSocket, takes over full projection
- **Interactive effects** — fire lightning and candy rain — via REST POST (projection only, debounced)
- **Multi-year data** — schema separates year in events table, supports future years

**2026 Goals:**

- Deployable Spring Boot server in Docker image
- Database: managed remote Postgres (Flyway auto-migrations)
- Garage computer hosts app via Tailscale (WireGuard between garage → server)

---

## 2. System Architecture

**Topology:**

```
[Garage laptop with HDMI projector]
        ↓ (Tailscale WireGuard tunnel)
      [Personal Server]
        ↓ (Tailscale Funnel URL)
      [Phones: viewer/admin/game]
        ↓ HTTPS/WSS
      [Remote Managed Postgres]
```

**Server:** Spring Boot running in Docker image on your personal server
**DB:** Cloud-hosted Postgres (e.g., AWS RDS, Neon, Supabase)
**Internal routing:** Garage machine → Server via Tailscale WireGuard
**Phone routing:** Public → Tailscale Funnel URL

---

## 3. Database Schema

### `events` table

| Column            | Type                       | Description                                                  |
| ----------------- | -------------------------- | ------------------------------------------------------------ |
| `id`              | `BIGINT` PK                | event ID                                                     |
| `year`            | `INTEGER`                  | explicitly split per year (e.g., 2025)                       |
| `timestamp`       | `TIMESTAMP WITH TIME ZONE` | event time (UTC)                                             |
| `type`            | `VARCHAR(20)` NOT NULL     | `increment`, `effect_lightning`, `effect_candy_rain`, `vote` |
| `candy_type`      | `VARCHAR(50)` NULL         | e.g., `snickers`, `m&ms`, `twix` (used for vote events)      |
| `game_session_id` | `UUID` NULL                | links game events to session                                 |
| `score`           | `INTEGER` NULL             | game score value for game events                             |

### `statistics` (optional inferred views)

- `SELECT SUM(*) FROM events WHERE year=X AND type='increment'` for total count
- `SELECT COUNT(*) FROM events WHERE year=X AND type='vote' AND candy_type=Y` for vote totals

### `game_sessions` (for WebSocket)

(In-memory optional, or ephemeral table for diagnostic tracking.)

---

## 4. Backend API Spec

Base URL: `https://your-server`

All endpoints support both SSE (for viewer projection) and WebSocket (for game) depending on route.

### Core: Increment + Update

| Endpoint             | Method | Auth     | Description                                                                |
| -------------------- | ------ | -------- | -------------------------------------------------------------------------- |
| `/api/counter`       | POST   | ✅ token | `{type: "increment"}`, increments current count by 1                       |
| `/api/counter/state` | GET    | ✅ token | returns current count, initial candy total, mode (idle \| game), signed in |
| `/api/state`         | GET    | ✅ token | aggregates state: total count + status                                     |
| `/api/stats`         | GET    | ✅ token | returns aggregated statistics by year                                      |
| `/api/events`        | POST   | ✅ token | fire `lightning` or `candy_rain` (debounced server-side)                   |
| `/api/vote`          | POST   | ❌ none  | cast vote for candy type: `{type: "vote", candy_type: "snickers"}`         |

_Token-based authentication: passed as `?token=hex-string` or `Authorization: Bearer <token>`. The burner value is publicly visible at the admin endpoint (published via QR code)._

### Effects (controlling projection visuals)

| Endpoint                  | Method | Description              |
| ------------------------- | ------ | ------------------------ |
| `/api/effects/lightning`  | POST   | trigger lightning effect |
| `/api/effects/candy-rain` | POST   | trigger candy rain       |

Debounce: effects can't fire again until animation completes (approx 5-10s cooldown).

### WebSocket: Game Control

| Event                | Direction       | Payload                                                                |
| -------------------- | --------------- | ---------------------------------------------------------------------- |
| `game_start`         | Client → Server | `{type: "game_start", difficulty: "easy"}`                             |
| `game_started`       | Server → Client | `{type: "game_started", sessionId: "<uuid>"}`                          |
| `game_start_denied`  | Server → Client | `{type: "game_start_denied", reason: "already_active"}`                |
| `zombie_hit`         | Client → Server | `{type: "zombie_hit", zombieId: "123"}`                                |
| `zombie_spawned`     | Server → Client | `{type: "zombie_spawned", zombieId: "123", direction: 0}`              |
| `zombie_missed`      | Server → Client | `{type: "zombie_missed", zombieId: "123"}`                             |
| `score_update`       | Server → Client | `{type: "score_update", result: "hit", score: 3}`                      |
| `game_end`           | Client → Server | `{type: "game_end"}`                                                   |
| `game_ended`         | Server → Client | `{type: "game_ended", score: 7}`                                       |

See `docs/api.md` WebSocket section for the full authoritative protocol including difficulty levels and auto-end behaviour.

### Page Routing (Server serves static bundle)

| Route       | Public    | Description                                     |
| ----------- | --------- | ----------------------------------------------- |
| `/`         | ✅ Public | Live counter + zombies + lightning + candy rain |
| `/remote`   | ✔ Admin   | Big increment button (Easy Press)               |
| `/settings` | ✔ Admin   | Override total count / initial candy            |
| `/stats`    | ✅ Public | View charts + vote + game score                 |
| `/game`     | ✅ Public | Whack-a-zombie game (WebSocket drive)           |

Server also serves `/qr.png` (pre-baked QR codes), and `/ws` endpoint for game WebSocket connection.

---

## 5. Frontend Routes + Components

### Live Counter Display (`/`)

- **Counter component**: Memoized big count display (+ flip animation on digit change)
- **Candy progress bar**: Visual progress vs. initial candy (e.g., "283/300")
- **Zombie (Rive)**: Display, max 50 concurrent sauced zombies, colored via CSS hue-rotate filter
- **LightningCanvas + DroolingRain**: Random spark timers UNTIL user presses button; projection-only
- **Stats display (hidden on phones)**: view on visit `/stats`

### Stats Routes (`/stats`)

Phone view shows:

- **Total candies given**
- **Rate chart** (Recharts histogram: minute-by-minute flow)
- **Vote for candy** (buttons: Snickers, M&M's, Twix)
- **Last year's total** rendered as synthetic timestamps at 18:00 PDT (same chart template)
- **Share a PNG** for game score via `<canvas>` rendered to share link

### Admin Remote (`/remote`)

Plain HTML page with a single big tap-controlled button. Bypasses iframe/viewport issues, just fires `{type: "increment"}`.

### Admin Settings (`/settings`)

Allows:

- Override total count
- Reset initial candy count
- Refresh tokens printed as QR codes
- Generate the shareable "Admin Badge"

### Game (`/game`)

Whack-a-zombie:

- **Phone**: shows "Waiting for game," countdown, final score
- **Projection**: zombies spawn one-at-a-time (max 3) on left/right edges and stomp toward center. Each zombie takes ~2-3 seconds before reaching the candy bar.
- **Phone taps right/left**: fires WebSocket `{type: "game_action", zombie_id: "some_UUID"}`
- **Scoring**: +1 for hit, -1 for missed zombie reaching candy
- **Ends**: after ~30 seconds; phone shows final score + optional "Share" preview (canvas-generated PNG)

Game stages:

1. Phone connects WS → screen sends "Waiting for player"
2. Phone tests message "start"
3. Server validates no other active game → "Game starting"
4. Zombies spawn and attempt to reach candy
5. Phone presses fire → WS message → server spawns fewer zombies + feels hit / missed
6. Game ends → server reports final score back to phone

---

## 6. Game: Whack-a-zombie

### Gameplay loop

1. **Spawn zombie** on either left or right edge (random choice)
2. **Zombie moves** toward center candy bar (~2-3s
3. **Phone presses exact side in time** → scores point, lightning visual flashed on projection
4. **Missed time** → zombie hits candy → -1 point
5. **Total window**: ~30 seconds, approx 10-15 zombies
6. **End game**: server sides we broadcast score, final screenshot shareable

### Complexity states

- **easy**: spawn one zombie at a time
- **hard**: up to 3 zombies concurrently
- **lightning**: spawn one big zombie, faster, hits up by 2 pts

Hard cap: 50 concurrent zombies max (checked with Rive crash at 300).

### Returns from zombie

Zombies use CSS `filter: hue-rotate(Ndeg)` based on their type ID (0=red, 1=green, 2=blue, etc.) — to make single asset repeatable.

---

## 7. Effects: Lightning & Candy Rain

### Trigger

`POST /api/effects/lightning` (or `/candy-rain`)

### Display

- **Projection only** (default for projection on garage door)
- **Debounce on server**: until previous effect completes (approx 5-10s)

### Object

- **LightningCanvas effect**: draws lightning over the projection — WebGL canvas
- **CandyRain effect**: DuoLingo/Slack dancing candy animation — DOM-based rain effect

Effect does NOT affect data or statistics (projection only).

---

## 8. Infrastructure + Deployment

### Server Base Image

- **Language**: JVM (Java 21+/Spring Boot 3.x does Spring Boot Web + WebSocket + SSE + Flyway)
- **Container**: Multi-stage docker file:
  - `maven build container` compiles → WAR/JAR + assets
  - `runtime container` Java 21 JRE/JVM, runs JAR/WAR

### State management

Server state:

- **Connection limit: SSR 100 concurrent connections** (randomly generous for game)
- **Session store: none** (game sessions ephemeral)
- **Memory: < 512 MB** hard cap possible (demo purposes, delete old logs, exchange rate server if it will fight each other).

### Migration Scripts (Flyway)

- `v1__initial_setup.sql`: create `events`, `game_sessions`, `schema version`
- `v2__add_year_index.sql`: add index
- `v3__add_candy_type.sql`: add `candy_type` for vote events

---

## 9. Admin Token Management

**Two tokens** — **admin token**, **settings token**:

- Admin URL: `/remote?token=abcdef...`
- Settings URL: `/settings?token=xyz...`
- QR codes pre-built inside Docker bundle
- **Shareable**: tokens derived from env (`ADMIN_TOKEN=blahblahblah`)

**For burned tokens,** admin settings can manually reset indicators of invulnerable access.

---

## 10. Out of Scope (Future)

- [ ] **Last-30-days server history** (attempting multi-year tracking)
- [ ] **Multiple simultaneous game sessions** (validated steady only one active at a time)
- [ ] **Social media integration** via native share buttons
- [ ] **DMCA immunization** (games like Whack-a-zombie are public domain)
- [ ] **Voice-prompt** (listen to Project-Alice commands on/off)

---

## Assumptions + Caveats

- You've got a Raspberry Pi, older laptop, or dedicated HomLab for the TV-free garage projection
- Your local machine is **not** producing the streaming audio or video (just regular HDMI)
- Garages and TVs use HDMI and are internet-connected to expose Tailscale Funnel
- Tokens are randomly generated with extreme caution (I'm assuming they're bytes to eliminate brute force)

---

## Success Criteria

"Give me a hecktic Halloween at 2026"

1. ✅ Deploy Spring Boot container at the garage laptop
2. ✅ Show stable count + zombie visuals (max 50) during entire night
3. ✅ Manage count via admin (rate limit not necessary, but themed lighthearteless still accepted)
4. ✅ Present viewers with chart + vote + share
5. ✅ Play GAME sessions via WebSocket
6. ✅ Serve ~300 users broadcast via Tailscale Funnel all-night
7. ✅ Managed Postgres online (+N backup in obscure scale like Neon)

---

**Next step:** Tweak the metrics (hard caps, timeouts, connect durations) for the testing plan, implement the game and then verify and productionalize.

This PRD is newly drafted for the Aug 28 session. For collaborative editing, an editable drawing might be more comfortable.
