#!/usr/bin/env bash
# Dump the candy database to a timestamped, gzipped file.
#
# Run from the deploy/ directory on the server (or via cron, see
# docs/deployment.md). Keeps the last 30 dumps.
#
# Restore with:
#   gunzip -c backups/candy-<timestamp>.sql.gz | \
#     docker compose exec -T postgres psql -U candy_user -d candy

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="backups/candy-${STAMP}.sql.gz"

docker compose exec -T postgres pg_dump -U candy_user candy | gzip > "${OUT}"
echo "Wrote ${OUT} ($(du -h "${OUT}" | cut -f1))"

# Prune: keep the 30 most recent dumps
ls -1t backups/candy-*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm --
