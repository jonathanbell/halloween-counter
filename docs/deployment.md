# Deployment Guide

The app deploys to `francesco`, a shared Ubuntu box that already runs a
Caddy reverse proxy, other apps, and a host PostgreSQL 16. This repo ships
exactly two deployment artifacts: the `Dockerfile` (the image) and the
`Makefile` (the release loop from this machine). All server-side runtime
configuration lives on the box itself, in its single compose project at
`/opt/stack`.

The box documents itself: its rules and runbooks live on the server (under
`/root`), and that is where server-side questions get answered. This
document covers the day-to-day loop from this machine, plus enough of the
server's shape to reason about failures.

ADR-014 in `docs/design-decisions.md` records why the repo no longer ships
its own compose/Caddy/Postgres stack.

## Topology

```
                 [halloween-counter.jonathanbell.ca]
                                 |
              +------------------v-------------------+
              |  FRANCESCO (shared Ubuntu box)       |
              |                                      |
              |  [stack-caddy]  :80/:443             |
              |     | owns TLS for all sites on box  |
              |     v                                |
              |  [stack-halloween]  :8080 internal   |
              |     | Spring Boot + static bundle    |
              |     v                                |
              |  host PostgreSQL 16  (172.30.0.1:6542,
              |     `candy` DB, role `candy`)        |
              |                                      |
              |  ...other apps in the same stack     |
              +--------------------------------------+
                    ^                        ^
     [Garage laptop browser]        [Phones: viewer/admin/game]
```

House rules on that box (details in its own docs): only Caddy publishes
ports, secrets live in `/opt/stack/.env` (`HALLOWEEN_*` variables), image
tags are pinned (no `:latest`), and RAM is the scarce resource - the app
runs under a 768 MiB `mem_limit`.

## Day-to-day: the Makefile

Everything runs from this repo on the Mac. `francesco` is an alias in
`~/.ssh/config`.

```bash
make deploy          # bundle -> build amd64 image -> ship -> release -> verify
make smoke           # boot the built image + throwaway Postgres on :8080
make smoke-down      # stop the local smoke stack
make rollback TAG=x  # re-point the server at an already-shipped tag
make logs            # tail app logs on the server
make status          # compose ps + memory on the server
make verify          # health + public state check
```

Images are tagged with the git short sha (`candy-counter:<sha>`, plus
`-dirty` if the tree has uncommitted changes), so every deploy is
traceable and `make rollback TAG=<previous-sha>` is exact. Old images stay
loaded on the box until pruned - keep the last known-good one.

`make deploy` refuses to run until the one-time server setup exists, and
`make verify` checks health from inside the container first (the public
`/actuator` may be 404'd at the proxy), then hits the public API.

## Before shipping anything real

- `make smoke` boots the exact image against real Postgres 16 locally.
  This is what caught Flyway's missing Postgres module - H2 and the unit
  tests cannot catch that class of bug. Run it before first-of-season
  deploys and after dependency changes.
- If frontend source changed, `make deploy` already rebundles (`bundle` is
  a dependency of `image`).

## What exists on the box (one-time setup, done server-side)

`make deploy` assumes this is in place; it was set up once on the box,
whose own docs are authoritative:

- DNS A record for `halloween-counter.jonathanbell.ca` -> the box.
- A `candy` database and `candy` role on the host PostgreSQL (port 6542,
  reachable from containers at `172.30.0.1`, `sslmode=require`).
- `HALLOWEEN_DB_PASSWORD` / `HALLOWEEN_ADMIN_TOKEN` /
  `HALLOWEEN_SETTINGS_TOKEN` in `/opt/stack/.env` (mode 0600), mapped onto
  the app's env-var contract by the compose service block.
- The `halloween` service in `/opt/stack/compose.yaml`: pinned
  `candy-counter:<tag>` image, `mem_limit: 768m`, internal network only,
  `${VAR:?}` guards so missing secrets fail loudly instead of booting on
  the app's weak built-in token defaults.
- A Caddy site block proxying the domain to `halloween:8080` (Caddy
  auto-issues the certificate; SSE and WebSocket pass through without
  extra config, and gzip is deliberately off because compression and SSE
  interact badly).

After that, `make deploy` handles every release.

## QR codes

Unchanged by the topology: generate against the public domain, rebundle,
redeploy.

```bash
npm run qr https://halloween-counter.jonathanbell.ca <admin-token> <settings-token>
make deploy
```

## Verification beyond `make verify`

For a first deploy or the dress rehearsal, also prove the two streaming
transports survive the proxy - these are the things a reverse proxy
breaks silently.

SSE must sit open and dribble events out (not return everything at once
at the end):

```bash
curl -N --max-time 15 https://halloween-counter.jonathanbell.ca/api/events
```

The WebSocket upgrade must reach the app - expect `101` (or a 400/426
from the app), not a 502 from the proxy:

```bash
curl -sSi -o /dev/null -w '%{http_code}\n' \
  -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  https://halloween-counter.jonathanbell.ca/ws/game
```

The real test is opening the page in a browser and watching the counter
update.

## Dress rehearsal (do this in October)

- [ ] `make deploy` a fresh build; `make verify` passes
- [ ] Projection open on the garage laptop over garage wifi for 1+ hour;
      count updates and the SSE connection survives idling
- [ ] Increment from the admin phone on cellular (not wifi)
- [ ] Play a full game on each difficulty from a phone; judge lag yourself
- [ ] Fire both effects; confirm 7 s cooldown and projection visuals
- [ ] `ssh francesco 'cd /opt/stack && docker compose restart halloween'`
      mid-count; screens recover without a manual refresh
- [ ] `make rollback TAG=<previous>` and back - prove the path works
- [ ] `make status` - box memory is sane with the app under load
- [ ] `ping halloween-counter.jonathanbell.ca` from garage wifi and phone
      LTE; expect well under 100 ms

## Failure modes

| Failure | Effect | Response |
|---------|--------|----------|
| Garage wifi drops | Projection freezes at last count | Tether laptop to a phone hotspot; SSE reconnects on its own |
| Admin phone wifi drops | Increment button fails | Phone falls back to LTE automatically; keep cell data on |
| App wedged | All screens stall | `ssh francesco 'cd /opt/stack && docker compose restart halloween'`; state is in Postgres |
| Bad deploy | Errors after release | `make rollback TAG=<previous-sha>` |
| 502 mentioning `127.0.0.11:53` | Stale Docker DNS on the box | `cd /opt/stack && docker compose down && docker compose up -d` (never `-v` - see the box runbook) |
| Plain 502 right after deploy | App still booting (~30 s) | Wait; `make logs` if it persists |
| Count is wrong | Wrong number on the door | `/settings.html` Set Total Count (writes an adjustment, deletes nothing) |

The app's data lives in the box's host PostgreSQL, which is managed and
backed up as part of that server, not from this repo.
