# Configuration Guide

Environment variables and config files for the Spring Boot backend.

## Environment Variables

| Variable            | Required (prod) | Purpose                                                                  |
| ------------------- | --------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`      | ✅ yes          | JDBC URL of the Postgres instance (e.g. `jdbc:postgresql://host:5432/candy`) |
| `DATABASE_USER`     | ✅ yes          | DB user                                                                  |
| `DATABASE_PASSWORD` | ✅ yes          | DB password                                                              |
| `ADMIN_TOKEN`       | ✅ yes          | Seeds the **admin** token, which gates `POST /api/counter` (increments)  |
| `SETTINGS_TOKEN`    | ✅ yes          | Seeds the **settings** token, which gates `/api/settings` and `/api/tokens` |

The settings token is the higher privilege of the two: it can change the
year config *and* rotate either token. Keep its QR code more private than
the admin one.

Spring reads the two tokens as `admin.token` and `admin.settings-token`
(see `application.yml`). They are injected into **`TokenService`**, not into
the filter - `AdminTokenFilter` calls `tokenService.resolveToken(name)` on
each request, and `TokenService` decides between the DB row and the env
value. See "Token Rotation" below.

In production these are set on the server: `/opt/stack/.env` holds
`HALLOWEEN_DB_PASSWORD`, `HALLOWEEN_ADMIN_TOKEN` and
`HALLOWEEN_SETTINGS_TOKEN`, which the box's compose service block maps onto
the variables above (`DATABASE_URL` / `DATABASE_USER` are fixed there to the
host PostgreSQL). See `docs/deployment.md` for the server's shape. The local
smoke stack (`compose.smoke.yml`) supplies throwaway values.

> `application.yml` ships placeholder token defaults
> (`your-default-fallback-admin-token-change-me`). They exist so the app can
> boot in a bare checkout; they must never reach production. The box's
> compose block uses `${VAR:?}` guards so a missing secret fails the
> container instead of quietly booting on a placeholder.

## Profiles (`src/main/resources`)

**`application.yml`** - the default, used in production and by `make smoke`:

- Postgres datasource driven by the `DATABASE_*` variables
- Flyway enabled, `baseline-on-migrate: false` on purpose - see the comment
  in the file. The app only ever migrates a fresh, empty database; baselining
  would silently skip `V1` against a dirty schema and leave `events`
  uncreated.
- Graceful shutdown, JSON dates as ISO-8601 strings (not epoch numbers)

**`application-local.yml`** (activate with
`-Dspring-boot.run.profiles=local`) - developer convenience only:

- H2 in-memory at `jdbc:h2:mem:candydb;MODE=PostgreSQL`. The
  `MODE=PostgreSQL` is what lets the same Flyway migrations run unchanged;
  it is also why the quoted `"year"` / `"timestamp"` identifiers matter.
- `ddl-auto: none` - Flyway owns the schema in every profile
- Tokens hardcoded as `dev-admin-token` / `dev-settings-token`
- Data is gone on every restart, by design

## Running against a local Postgres

Flyway creates the tables on startup, but it will not create the *database*.
Create that once, then point Spring at it:

```bash
docker run -d \
  --name local-postgres \
  -e POSTGRES_USER=candy \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=candy \
  -p 5432:5432 \
  postgres:16
```

```bash
DATABASE_URL=jdbc:postgresql://localhost:5432/candy
DATABASE_USER=candy
DATABASE_PASSWORD=password
```

On first boot Flyway applies `V1` through `V6` (events, settings,
count_adjustment, the 2025 seed row, tokens, and the `game_score` event
type). In production the `candy` database and role were created once on the
server's host PostgreSQL; the smoke stack's Postgres container creates its
own.

`make smoke` is the honest test of this path - it boots the real image
against real Postgres 16 and is what caught Flyway's missing Postgres
module, which H2 and the unit tests cannot detect.

## Thread Safety Notes

- `SseBroadcaster` keeps its emitters in a `CopyOnWriteArrayList`.
  Broadcasting iterates the list while dead emitters are removed from other
  threads; a plain `ArrayList` throws `ConcurrentModificationException`
  mid-broadcast and drops every connected screen.
- `GameWebSocketHandler` and `GameService` keep their session state in
  `ConcurrentHashMap`s, and each game owns a scheduled executor that is shut
  down when the game ends.

## Token Rotation

Tokens resolve in this order, per request: **`tokens` table row → env var
fallback**.

- `ADMIN_TOKEN` / `SETTINGS_TOKEN` seed the system at deploy time.
- Rotating via the API writes a `tokens` row, which wins from that point on
  and persists across restarts.
- Deleting the row reverts to the env value - no restart needed, because
  resolution happens per request.

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

Rotation requires the **settings token**. Only `"admin"` and `"settings"`
are valid names; anything else returns `400 invalid_token_name`.

### After rotating

QR codes embed the token in the URL, so they must be regenerated and
re-printed. `make tokens` prints both live tokens from the server:

```bash
make tokens
npm run qr https://halloween-counter.jonathanbell.ca \
  <admin-token> <settings-token>
```

That writes `qr-print/admin-qr.png` and `qr-print/settings-qr.png`
(gitignored). Print them; there is nothing to deploy. Token-bearing QR
codes never go in `public/` - the repo is public and the app serves that
folder to anyone.

### Emergency recovery

If every token is lost, delete the rows and the env values take over again:

```sql
DELETE FROM tokens;  -- falls back to ADMIN_TOKEN / SETTINGS_TOKEN
```

No restart required.
