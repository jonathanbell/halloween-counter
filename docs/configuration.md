# Configuration Guide

Environment variables and config files for the Spring Boot backend.

## Environment Variables

| Variable | Required (Prod) | Purpose |
|-----------|--------------|---------|
| `DATABASE_URL` | ✅ yes | JDBC URL of your Postgres (e.g., `jdbc:postgresql://host:5432/candy`) |
| `DATABASE_USER` | ✅ yes | DB user |
| `DATABASE_PASSWORD` | ✅ yes | DB password |
| `ADMIN_TOKEN` | ✅ yes | Token accepted at `/api/counter` (scale event increment authors) |
| `SETTINGS_TOKEN` | ✅ yes | Token accepted at `/api/settings` (year config mutations) |

In the production compose stack these are set in `deploy/.env` (template:
`deploy/.env.example`, gitignored) and wired to the containers by
`deploy/docker-compose.yml` - `DATABASE_URL`/`DATABASE_USER` are fixed there
to the compose-internal `postgres` service, so only the password and the two
tokens need values. See `docs/deployment.md`.

Throw tokens from `@Value("${admin.token:...}")` / `@Value("${admin.settings-token:...}")` injection into `AdminTokenFilter` on each request.

## Profiles (src/main/resources)

`application.yml`
- Defaults used anywhere, usually empty
- PG defaults — the production profile builds for Docker tour

`application-local.yml`
- H2 in-memory (`MODE=PostgreSQL` for cross-compatibility)
- Different DB_URL reference for developer experience (`jdbc:h2:mem:candydb;MODE=PostgreSQL`)
- Hardcoded tokens (`dev-admin-token` / `dev-settings-token`) burned in

## Advices for setting Postgres schemas

Postgres won't exist and Create Table ... is run upon app start with Flyway V1/V2/V3 migrations. Create the database alone (`CREATE DATABASE candy;`) if needed and supply its URL. Flyway auto-migrations run through startup.

In the production compose stack none of this is manual: the `postgres`
container creates the `candy` database from its `POSTGRES_DB` env on first
boot, and Flyway migrates it when the app starts.

Sample local Postgres under Docker:

```bash
docker run -d \
  --name local-postgres \
  -e POSTGRES_USER=candy \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=candy \
  -p 5432:5432 \
  postgres:16
```

Feed that DB to Spring:

```bash
DATABASE_URL=jdbc:postgresql://localhost:5432/candy
DATABASE_USER=candy
DATABASE_PASSWORD=password
```

## Thread Safety Notes

- SSE broadcasters use `CopyOnWriteArrayList` — broadcast + unlimited access unpaired
- WebSocket session maps via `ConcurrentHashMap`

## Where flux event publishing handles callbacks

Counter increment pushes `ApplicationEventPublisher.publishEvent` and awaits until AFTER_COMMIT via `TransactionalEventListener(phase = AFTER_COMMIT)` on SseBroadcaster. Runtime publishing avoids connection-receive for booth tree downstream publishing.

## Token Rotation

Tokens are resolved in this order: **DB (`tokens` table) → env var fallback**.

- Env vars `ADMIN_TOKEN` / `SETTINGS_TOKEN` seed the system at deploy time.
- Rotating via the API writes to the `tokens` table and overrides env values
  from that point on (persists across restarts).
- To revert to env values, delete the row from the `tokens` table.

### Rotate a token

```bash
curl -X POST https://your-server/api/tokens/rotate \
  -H "Authorization: Bearer $SETTINGS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "admin"}'
```

Response:

```json
{
  "name": "admin",
  "token": "a1b2c3...48-hex-chars",
  "warning": "QR codes must be regenerated: npm run qr <publicUrl> <adminToken> <settingsToken>"
}
```

Rotation requires the **settings token** (highest privilege). Only `"admin"`
or `"settings"` are valid names.

### After rotating

QR codes embed the token in the URL, so they must be re-printed:

```bash
npm run qr https://halloween-counter.jonathanbell.ca \
  <new-admin-token> <settings-token>
```

This writes `public/qr/admin-qr.png` and `public/qr/settings-qr.png`.
Then `npm run bundle` (which copies them into the static bundle), rebuild
the image, and re-ship it (`docs/deployment.md`).

### Emergency recovery

If you lose all tokens: the env vars are still the fallback as long as the
`tokens` table rows are deleted. Connect to the DB directly:

```sql
DELETE FROM tokens;  -- falls back to ADMIN_TOKEN / SETTINGS_TOKEN env vars
```

Then restart the app (or not — resolution happens per-request).
