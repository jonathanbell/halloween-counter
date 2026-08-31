# Deployment Guide: Cloud Box Topology

How the candy counter is deployed for Halloween 2026. This supersedes the
Tailscale topology described in the PRD (sections 2 and 8); the decision
record is ADR-013 in `docs/design-decisions.md`.

## Topology

Everything runs on one Ubuntu cloud server (Oregon). The garage laptop is
just a browser. Tailscale is not used.

```
                    [halloween-counter.jonathanbell.ca]
                                   |
                              DNS A record
                                   |
                  +----------------v-----------------+
                  |     UBUNTU CLOUD BOX (Oregon)    |
                  |                                  |
                  |  [caddy]  :80/:443 (published)   |
                  |     |  TLS via Let's Encrypt     |
                  |     v                            |
                  |  [app]  :8080 (compose network)  |
                  |     |  Spring Boot + static UI   |
                  |     v                            |
                  |  [postgres]  :5432 (compose      |
                  |      network only, pgdata volume)|
                  +----------------------------------+
                        ^                    ^
        HTTPS + WSS     |                    |    HTTPS + WSS
                        |                    |
        [Garage laptop browser]     [Phones: viewer / admin / game]
        /?projection&token=...      QR codes -> the public domain
```

Old topology for contrast: app on a personal server reached by the garage
laptop over Tailscale WireGuard and by phones over a Tailscale Funnel URL,
with a managed remote Postgres. All three hops are gone.

## Why this works (and the latency question)

- The frontend has no localhost assumptions: API calls are relative, the
  game WebSocket URL is derived from `location.host`, and `wss:` is picked
  automatically on HTTPS pages. No code changes were needed for this move.
- BC to Oregon is 15-35 ms RTT on home internet, 50-90 ms on phone LTE.
  The game's hit/miss window is the zombie TTL (1500-3000 ms), and the
  server ticks at 500-600 ms. Network jitter is two orders of magnitude
  below anything a player can perceive. The phone UI also removes tapped
  zombies optimistically, so tap feedback is instant regardless.
- The old phone path went through Tailscale Funnel's relays; going direct
  to the box is equal or faster.
- The honest tradeoff: the night now depends on garage internet staying
  up. See "Failure modes" below.

## Prerequisites

- Ubuntu 22.04+ cloud server, 2 GB RAM recommended (the app is capped at
  `-Xmx384m`; 1 GB works but leaves little headroom next to Postgres).
- SSH access with keys.
- Control of DNS for `jonathanbell.ca`.
- Docker + the compose plugin on the server, and Docker locally to build.

## One-time server setup

1. **DNS**: create an A record for `halloween-counter.jonathanbell.ca`
   pointing at the box's public IP. Verify with
   `dig +short halloween-counter.jonathanbell.ca`.

2. **Docker** (on the box):

   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out/in afterwards
   ```

3. **Firewall**: only SSH, HTTP, and HTTPS are reachable.

   ```bash
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

   Note: Docker publishes ports by bypassing ufw, so the real guarantee is
   the compose file itself - only `caddy` has a `ports:` section. The app
   and Postgres exist solely on the compose-internal network and are not
   reachable from the internet no matter what ufw says.

4. **Deploy directory**: copy the `deploy/` folder to the box (or clone the
   repo). Then create the secrets file:

   ```bash
   cd deploy
   cp .env.example .env
   openssl rand -hex 24   # run three times: db password, admin, settings
   vim .env
   ```

## Building and shipping the image

The image is built locally and shipped to the box. Two options.

**Important (Apple Silicon):** the Mac builds arm64 by default; a typical
cloud box is amd64. Always cross-build:

```bash
docker build --platform linux/amd64 -t candy-counter:latest .
```

Remember the frontend: if any frontend source changed, run `npm run bundle`
first so the image picks up the current static bundle.

### Option A: docker save over SSH (no registry, default)

```bash
docker save candy-counter:latest | gzip | \
  ssh <server> 'gunzip | docker load'
```

The compose file references `candy-counter:latest`, which matches the
loaded tag directly.

### Option B: GitHub Container Registry

```bash
docker tag candy-counter:latest ghcr.io/<user>/candy-counter:latest
docker push ghcr.io/<user>/candy-counter:latest
```

Then change `image:` in `deploy/docker-compose.yml` to the ghcr path and
`docker compose pull` on the box. Requires a `docker login ghcr.io` there.

## First deploy

```bash
cd deploy
docker compose up -d
docker compose logs -f app     # watch Flyway run V1..V5 on first boot
```

Flyway creates and seeds the schema automatically (settings row for 2026,
the 2025 comparison data, everything). There is no manual SQL step.

Verify:

```bash
curl https://halloween-counter.jonathanbell.ca/actuator/health   # {"status":"UP"}
curl https://halloween-counter.jonathanbell.ca/api/state?year=2026
```

Caddy fetches the TLS certificate on the first request; if HTTPS fails in
the first minute, check `docker compose logs caddy` (usually DNS not
propagated yet or port 80 blocked).

## QR codes

Tokens are baked into the printed QR codes, so generate them after `.env`
is final:

```bash
npm run qr https://halloween-counter.jonathanbell.ca <admin-token> <settings-token>
# writes public/qr/admin-qr.png + settings-qr.png
```

Then `npm run bundle`, rebuild the image, and re-ship (the QR pages are
served from the static bundle). Print:

- Public QR: just `https://halloween-counter.jonathanbell.ca` (viewers)
- Admin QR (private): `/remote.html?token=...`
- Settings QR (private): `/settings.html?token=...`

## Backups

Postgres data lives in the `pgdata` volume on the box. `deploy/backup.sh`
writes a timestamped `pg_dump` to `deploy/backups/` and keeps the last 30.

Nightly cron on the box:

```
0 9 * * * /home/<user>/deploy/backup.sh >> /home/<user>/deploy/backups/backup.log 2>&1
```

On Halloween: run it once before the night starts and once after. Restore:

```bash
gunzip -c backups/candy-<stamp>.sql.gz | \
  docker compose exec -T postgres psql -U candy_user -d candy
```

Optionally scp a dump off the box for an off-machine copy.

## Updating the app

```bash
# locally
npm run bundle                                      # if frontend changed
docker build --platform linux/amd64 -t candy-counter:latest .
docker save candy-counter:latest | gzip | ssh <server> 'gunzip | docker load'

# on the box
cd deploy && docker compose up -d app
```

State survives restarts: everything lives in Postgres, SSE clients
reconnect automatically with backoff, and the projection re-seeds itself
from `/api/state` (including mid-game status).

## Token rotation on this topology

Rotation works exactly as documented in `docs/configuration.md`, against
the public domain:

```bash
curl -X POST https://halloween-counter.jonathanbell.ca/api/tokens/rotate \
  -H "Authorization: Bearer $SETTINGS_TOKEN" \
  -H "Content-Type: application/json" -d '{"name": "admin"}'
```

Emergency recovery (all tokens lost) - the env vars in `.env` are the
fallback once the DB rows are gone:

```bash
docker compose exec postgres psql -U candy_user -d candy -c 'DELETE FROM tokens;'
```

## Operations quick reference

```bash
docker compose ps                      # stack status
docker compose logs -f app             # app logs (Flyway, requests, game)
docker compose logs -f caddy           # TLS / proxy logs
docker compose restart app             # bounce just the app
docker compose exec postgres psql -U candy_user -d candy   # SQL shell
docker compose down                    # stop stack (volumes persist)
```

## Dress rehearsal (do this in October)

- [ ] Full deploy from scratch using only this document
- [ ] Projection open on the garage laptop over garage wifi for 1+ hour;
      confirm the count updates and the SSE connection survives idling
- [ ] Increment from the admin phone on cellular (not wifi) - this proves
      the cell-data fallback works
- [ ] Play a full game on each difficulty from a phone; judge lag yourself
- [ ] Fire both effects; confirm 7 s cooldown and projection visuals
- [ ] Kill the app container mid-count (`docker compose restart app`);
      confirm screens recover without a manual refresh
- [ ] Reboot the box; confirm the stack comes back (`restart:
      unless-stopped` + Docker's boot service) and HTTPS still works
- [ ] Run `backup.sh`, restore the dump into a scratch database
- [ ] `ping halloween-counter.jonathanbell.ca` from garage wifi and phone
      LTE; expect well under 100 ms

## Failure modes

| Failure | Effect | Response |
|---------|--------|----------|
| Garage wifi drops | Projection freezes at last count | Tether laptop to a phone hotspot; SSE reconnects on its own |
| Admin phone wifi drops | Increment button fails | Phone falls back to LTE automatically; keep cell data on |
| App container wedged | All screens stall | `docker compose restart app`; state is in Postgres |
| Box reboots | Minutes of downtime | Stack auto-starts; verify with `/actuator/health` |
| Cert renewal broken | HTTPS errors | `docker compose logs caddy`; check DNS + port 80 |
| Count is wrong | Wrong number on the door | `/settings.html` Set Total Count (writes an adjustment, deletes nothing) |
| Postgres data loss | Counter resets | Restore latest `backups/` dump |

The single realistic risk for the night is garage internet. The cloud box,
by contrast, is in a datacenter with better uptime than anything in the
garage. Cell tethering covers the gap either way.
