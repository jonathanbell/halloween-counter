# Halloween 2026 Candy Counter 🎃

Spring Boot + Vite/React counter projected onto a garage door. Live count, votes, interactive effects, and a WebSocket game (Whack-a-Zombie). Deploys as a compose stack (Caddy + app + Postgres) on a single cloud server behind `halloween-counter.jonathanbell.ca`; the garage laptop is just a browser.

## Prerequisites

- Java 21 (Temurin/Corretto) + Maven 3.9+
- Node 20+ / npm
- Docker (deployment only)
- Postgres (production only, provided by the compose stack; local dev uses
  in-memory H2)

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
npm run bundle    # build + replace src/main/resources/static wholesale
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
(`npm run bundle` - it deletes the old bundle first so stale hashed assets
never pile up in the jar).

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
# On Apple Silicon: cross-build for the amd64 cloud box
docker build --platform linux/amd64 -t candy-counter:latest .
```

Two-stage build (Maven -> JRE 21). Tokens have no baked defaults - they come
from `deploy/.env` in production. Health: `GET /actuator/health` (used by
the container HEALTHCHECK).

Production runs via `deploy/docker-compose.yml`: Caddy terminates TLS
(automatic Let's Encrypt), and the app + Postgres live only on the internal
compose network. Full guide: `docs/deployment.md`.

## Halloween Night Runbook

### The week before

Full detail in `docs/deployment.md` (including the October dress-rehearsal
checklist); the short version:

1. DNS A record: `halloween-counter.jonathanbell.ca` -> the cloud box.
2. On the box: Docker + ufw (80/443/SSH only), copy `deploy/`, fill in
   `deploy/.env` with `openssl rand -hex 24` values.
3. Build locally (`docker build --platform linux/amd64 ...`), ship with
   `docker save | ssh ... docker load`, then `docker compose up -d`.
   Flyway migrates and seeds on first boot; check
   `https://halloween-counter.jonathanbell.ca/actuator/health` returns `UP`.
4. Bake and print QR codes:
   ```bash
   npm run qr https://halloween-counter.jonathanbell.ca <admin-token> <settings-token>
   # writes public/qr/admin-qr.png + settings-qr.png
   ```
   Rebundle + re-ship so the printed QRs are also served by the app. Print
   a public QR (plain URL) for viewers, keep the admin/settings QRs private.
5. Set the candy supply: open `/settings.html?token=<settings>` and set
   Initial Candy Count.
6. Run `deploy/backup.sh` once so the backup path is proven.

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
  curl -X POST https://halloween-counter.jonathanbell.ca/api/tokens/rotate \
    -H "Authorization: Bearer $SETTINGS_TOKEN" \
    -H "Content-Type: application/json" -d '{"name": "admin"}'
  ```
- **All tokens lost**: delete the `tokens` rows to restore the env-var values
  (per-request, no restart needed):
  ```bash
  docker compose exec postgres psql -U candy_user -d candy -c 'DELETE FROM tokens;'
  ```
- **App wedged**: `docker compose restart app` on the box. All state lives in
  Postgres; screens reconnect on their own (SSE auto-reconnects with backoff)
  and the projection re-seeds count + game status from `/api/state`.
- **Garage internet down**: tether the laptop to a phone hotspot; the admin
  phone falls back to cellular automatically. The app itself is unaffected -
  it lives in a datacenter, not the garage.

### After

`/stats` compares 2026 against 2025 (346 candies, seeded). Data is stored
per-year, so next year is a settings row away.

## Documentation

- `AGENTS.md` - agent-focused project guide (architecture, data model, conventions)
- `docs/api.md` - full API + WebSocket protocol reference
- `docs/deployment.md` - cloud box deployment runbook (compose, TLS, backups)
- `docs/configuration.md` - env vars, profiles, token rotation detail
- `docs/design-decisions.md` - ADRs (ADR-013 covers the cloud topology)
- `docs/PRD_2026_HALLOWEEN.md` - product requirements (topology superseded by ADR-013)
- `TODO.md` - known gaps vs the PRD

## Credits

- Zombie animations: [Rive Community](https://rive.app/community/files/205-385-zombie-character/)
- Original counter design: last year's Node version
