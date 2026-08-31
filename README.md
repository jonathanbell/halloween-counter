# Halloween 2026 Candy Counter 🎃

Spring Boot + Vite/React counter and game projected onto a garage door Halloween night. Live count, votes, interactive effects, and a WebSocket game (Whack-a-Zombie). Deploys as a Docker image to a shared cloud server behind `halloween-counter.jonathanbell.ca`; the garage laptop is just a browser logged in and displaying the counter.

## Prerequisites

- Java 21 (Temurin/Corretto) + Maven 3.9+
- Node 20+ / npm
- Docker (deployment and `make smoke` only)
- Postgres (production only, provided by the server; local dev uses
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

| Route                             | Audience          | Purpose                                                 |
| --------------------------------- | ----------------- | ------------------------------------------------------- |
| `/` (React)                       | viewer            | counter + zombies + vote/effects controls               |
| `/?projection&token=<admin>`      | projector browser | controls hidden; spacebar increments                    |
| `/game` (React)                   | viewer phone      | Whack-a-Zombie controller (easy/hard/lightning)         |
| `/stats` (React)                  | viewer phone      | Recharts graphs, current + last year stats/data history |
| `/remote.html?token=<admin>`      | admin phone       | big increment button                                    |
| `/settings.html?token=<settings>` | admin             | initial candy + total override                          |

Projector keyboard: `Space` increment, `Ctrl+F` fullscreen toggle, `Ctrl+R` reset (jumps to settings).

## Backend API

Full reference with payloads: `docs/api.md`.

**Public**: `GET /api/state`, `GET /api/events` (SSE), `POST /api/effects/lightning|candy-rain`, `POST /api/vote`, `GET /api/stats`.

**Admin (token)**: `POST /api/counter`, `GET/POST /api/settings`, `POST /api/tokens/rotate`.

**Game**: WebSocket `/ws/game`.

## Database

PostgreSQL via Flyway migrations (`V1` events, `V2` settings, `V3` count_adjustment, `V4` 2025 seed, `V5` tokens). Quoted `"year"`/`"timestamp"` identifiers to survive H2 and PG reserved-word crossfire. `currentTotal = COUNT(increments) + count_adjustment`, so admin overrides never delete history.

## Deploying

```bash
make deploy          # bundle -> amd64 image -> ship over ssh -> release -> verify
make smoke           # boot the image + throwaway Postgres locally on :8080
make rollback TAG=x  # re-point the server at an already-shipped tag
make logs            # tail the app logs on the server
```

Two-stage Docker build (Maven -> JRE 21), images tagged by git sha. The
server (`francesco`, a shared box) owns all runtime config - its Caddy
terminates TLS, its host PostgreSQL holds the data, and secrets live in its
`/opt/stack/.env`. Full guide: `docs/deployment.md`. Health:
`GET /actuator/health` (used by the container HEALTHCHECK).

## Halloween Night Runbook

### The week before

Full detail in `docs/deployment.md` (including the October dress-rehearsal
checklist); the short version:

1. `make smoke` locally, then `make deploy`. Flyway migrates and seeds on
   first boot; `make verify` confirms health and the public API.
1. Bake and print QR codes:
   ```bash
   npm run qr https://halloween-counter.jonathanbell.ca <admin-token> <settings-token>
   # writes public/qr/admin-qr.png + settings-qr.png
   ```
   Then `make deploy` again so the printed QRs are also served by the app.
   Print a public QR (plain URL) for viewers, keep the admin/settings QRs
   private.
1. Set the candy supply: open `/settings.html?token=<settings>` and set
   Initial Candy Count.

### Showtime

1. Set laptop screensaver to NEVER engage.
1. Garage laptop browser: `/?projection&token=<admin-token>`, `Ctrl+F` for
   fullscreen. Spacebar increments as backup.
1. Admin phone: scan the admin QR -> `/remote.html` big button. Tap once per
   trick-or-treater.
1. Viewers: scan the public QR -> vote, fire lightning/candy rain (7s
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
  (per-request, no restart needed). On the server:
  ```bash
  ssh francesco
  su - postgres -c "psql -p 6542 -d candy -c 'DELETE FROM tokens;'"
  ```
- **App wedged**: `ssh francesco 'cd /opt/stack && docker compose restart
halloween'`. All state lives in Postgres; screens reconnect on their own
  (SSE auto-reconnects with backoff) and the projection re-seeds count +
  game status from `/api/state`.
- **Bad deploy**: `make rollback TAG=<previous-sha>`.
- **Garage internet down**: tether the laptop to a phone hotspot; the admin
  phone falls back to cellular automatically. The app itself is unaffected -
  it lives in a datacenter, not the garage.

### After

`/stats` compares 2026 against 2025 (346 candies, seeded). Data is stored
per-year, so next year is a settings row away.

## Documentation

- `AGENTS.md` - agent-focused project guide (architecture, data model, conventions)
- `docs/api.md` - full API + WebSocket protocol reference
- `docs/deployment.md` - deploy loop (`make deploy`, smoke, rollback) + server shape
- `docs/configuration.md` - env vars, profiles, token rotation detail
- `docs/PRD_2026_HALLOWEEN.md` - product requirements (topology superseded by ADR-013/014)
- `TODO.md` - known gaps vs the PRD

## Credits

- Zombie animations: [Rive Community](https://rive.app/community/files/205-385-zombie-character/)
