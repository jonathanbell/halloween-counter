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
