# Halloween 2026 Candy Counter 🎃

Spring Boot + Vite/React counter projected onto a garage door. Live count, votes, interactive effects, and a WebSocket game (Whack-a-Zombie). Deploys as a Docker image and runs against managed Postgres.

## Quick Start

Terminal A (backend):

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
# app on http://localhost:8080 (H2 in-memory DB)
```

Terminal B (frontend dev):

```bash
npm install
npm run dev
# vite on http://localhost:5173 (hits backend at :8080)
```

Or build the frontend into the server:

```bash
npm run build && cp -r dist/* src/main/resources/static/
mvn spring-boot:run
# then open http://localhost:8080
```

## Interfaces

| Route | Audience | Purpose |
|-------|----------|---------|
| `/` (React) | viewer/projection | counter + zombies + vote/effects controls |
| `/?projection` | projector browser | counter only, controls hidden |
| `/game` (React) | viewer phone | WS-driven Whack-a-Zombie controller |
| `/stats` (React) | viewer phone | Recharts graphs + last-year synthetic |
| `/remote.html?token=...` | admin | increment panel |
| `/settings.html?token=...` | admin | initial candy + total override |

Token env vars: `ADMIN_TOKEN` / `SETTINGS_TOKEN`.
Projector mode only hides controls; page semantics are the same.

## Backend API

**Public**: `GET /api/state`, `GET /api/events` (SSE), `POST /api/effects/lightning|candy-rain`, `POST /api/vote`, `GET /api/stats`.

**Admin (token)**: `POST /api/counter {year}`, `GET/POST /api/settings`.

**Game (WebSocket `/ws/game`)**: `game_start`, `zombie_hit`, `game_end` on client. `game_started|denied`, `zombie_spawned|missed`, `game_ended` on server. See `AGENTS.md` Section 4 for the full protocol.

## Database

PostgreSQL via Flyway migrations (`V1` events, `V2` settings, `V3` count_adjustment). Quoted `"year"`/`"timestamp"` identifiers to survive H2 and PG reserved-word crossfire.

Local dev uses in-memory H2 (`application-local.yml`) — empty per restart, switch to real PG by supplying `DATABASE_URL`/`USER`/`PASSWORD` env vars.

## Tests

```bash
mvn test          # 15 unit tests (services, token filter, game service)
npm run build     # TS check + static bundle it to server
```

## Docker

```bash
docker build -t candy-counter:latest .
docker run -p 8080:8080 \
  -e DATABASE_URL=jdbc:postgresql://host:5432/candy \
  -e DATABASE_USER=user -e DATABASE_PASSWORD=secret \
  -e ADMIN_TOKEN=mystrongtoken -e SETTINGS_TOKEN=other-strong-token \
  candy-counter:latest
```

Two-stage build (Maven → JRE) keeps the runtime image slim. Postgres lives on managed host outside the container.

## Documentation

- `AGENTS.md` — agent-focused project guide (architecture, data model, conventions)
- `docs/PRD_2026_HALLOWEEN.md` — product requirements for Halloween 2026
- `CLAUDE.md` — usage guidance for Claude sessions
- `docs/architecture.md` — high-level system walk (to be added)

## Credits
- Zombie animations: [Rive Community](https://rive.app/community/files/205-385-zombie-character/)
- Original counter design: last year's Node version
