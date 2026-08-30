# Halloween 2026 Candy Counter 🎃

Spring Boot + Vite/React counter projected onto a garage door. Live count, votes, interactive effects, and a WebSocket game (Whack-a-Zombie). Deploys as a Docker image and runs against managed Postgres.

## Prerequisites

- Java 21 (Temurin/Corretto) + Maven 3.9+
- Node 20+ / npm
- Docker (deployment only)
- Postgres (production only; local dev uses in-memory H2)

## Install

```bash
git clone <repo> && cd halloween-counter
npm install          # frontend deps
# Maven resolves Java deps on first run - nothing else to install
```

## Development

Terminal A (backend, H2 in-memory, empty each restart):

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
# http://localhost:8080
```

Terminal B (frontend with hot reload):

```bash
npm run dev
# http://localhost:5173 - proxies /api and /ws to :8080
```

Dev tokens (from `application-local.yml`): `dev-admin-token` / `dev-settings-token`.

Full-stack check without Vite (what production serves):

```bash
npm run build && cp -r dist/* src/main/resources/static/
mvn spring-boot:run -Dspring-boot.run.profiles=local
# http://localhost:8080
```

Verify before committing:

```bash
mvn test          # backend unit tests
npm run lint      # ESLint
npm run build     # TS check + bundle
```

Frontend changes that get committed must also refresh the static bundle
(`npm run build && cp -r dist/* src/main/resources/static/`).

## Interfaces

| Route | Audience | Purpose |
|-------|----------|---------|
| `/` (React) | viewer | counter + zombies + vote/effects controls |
| `/?projection&token=<admin>` | projector browser | controls hidden; spacebar increments |
| `/game` (React) | viewer phone | Whack-a-Zombie controller (easy/hard/lightning) |
| `/stats` (React) | viewer phone | Recharts graphs, current + last year |
| `/remote.html?token=<admin>` | admin phone | big increment button |
| `/settings.html?token=<settings>` | admin | initial candy + total override |

Projector keyboard: `Space` increment, `Ctrl+F` fullscreen toggle, `Ctrl+R` reset (jumps to settings).

## Backend API

Full reference with payloads: `docs/api.md`.

**Public**: `GET /api/state`, `GET /api/events` (SSE), `POST /api/effects/lightning|candy-rain`, `POST /api/vote`, `GET /api/stats`.

**Admin (token)**: `POST /api/counter`, `GET/POST /api/settings`, `POST /api/tokens/rotate`.

**Game**: WebSocket `/ws/game`.

## Database

PostgreSQL via Flyway migrations (`V1` events, `V2` settings, `V3` count_adjustment, `V4` 2025 seed, `V5` tokens). Quoted `"year"`/`"timestamp"` identifiers to survive H2 and PG reserved-word crossfire. `currentTotal = COUNT(increments) + count_adjustment`, so admin overrides never delete history.

## Docker

```bash
docker build -t candy-counter:latest .
docker run -p 8080:8080 \
  -e DATABASE_URL=jdbc:postgresql://host:5432/candy \
  -e DATABASE_USER=user -e DATABASE_PASSWORD=secret \
  -e ADMIN_TOKEN=strong-token -e SETTINGS_TOKEN=other-strong-token \
  candy-counter:latest
```

Two-stage build (Maven -> JRE 21). Tokens have no baked defaults - supply them at run time. Health: `GET /actuator/health` (used by the container HEALTHCHECK). Postgres lives on a managed host outside the container.

## Halloween Night Runbook

### The week before

1. Provision managed Postgres (Neon/RDS/etc.), `CREATE DATABASE candy;`.
   Flyway migrates on first boot.
2. Generate strong tokens (e.g. `openssl rand -hex 24`) for admin + settings.
3. Build and start the container with the env vars above; check
   `curl http://localhost:8080/actuator/health` returns `UP`.
4. Expose publicly via Tailscale Funnel; note the public URL.
5. Bake and print QR codes:
   ```bash
   npm run qr https://<funnel-url> <admin-token> <settings-token>
   # writes public/qr/admin-qr.png + settings-qr.png
   ```
   Print a public QR (plain URL) for viewers, keep the admin/settings QRs
   private.
6. Set the candy supply: open `/settings.html?token=<settings>` and set
   Initial Candy Count.

### Showtime

1. Garage laptop browser: `/?projection&token=<admin-token>`, `Ctrl+F` for
   fullscreen. Spacebar increments as backup.
2. Admin phone: scan the admin QR -> `/remote.html` big button. Tap once per
   trick-or-treater.
3. Viewers: scan the public QR -> vote, fire lightning/candy rain (7s
   cooldown), play `/game` (takes over the projection for 30s), browse `/stats`.

### When something goes wrong

- **Miscount**: `/settings.html` -> Set Total Count. It writes an adjustment;
  no events are deleted. All screens update over SSE immediately.
- **Token leaked/burned**: rotate it, then re-print that QR:
  ```bash
  curl -X POST https://<funnel-url>/api/tokens/rotate \
    -H "Authorization: Bearer $SETTINGS_TOKEN" \
    -H "Content-Type: application/json" -d '{"name": "admin"}'
  ```
- **All tokens lost**: `DELETE FROM tokens;` in Postgres restores the env-var
  values (per-request, no restart needed).
- **App wedged**: restart the container. All state lives in Postgres; screens
  reconnect on their own (SSE auto-reconnects with backoff).

### After

`/stats` compares 2026 against 2025 (346 candies, seeded). Data is stored
per-year, so next year is a settings row away.

## Documentation

- `AGENTS.md` - agent-focused project guide (architecture, data model, conventions)
- `docs/api.md` - full API + WebSocket protocol reference
- `docs/configuration.md` - env vars, profiles, token rotation detail
- `docs/design-decisions.md` - ADRs
- `docs/PRD_2026_HALLOWEEN.md` - product requirements
- `TODO.md` - known gaps vs the PRD

## Credits

- Zombie animations: [Rive Community](https://rive.app/community/files/205-385-zombie-character/)
- Original counter design: last year's Node version
