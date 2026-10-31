#!/usr/bin/env bash
# Print the live admin/settings tokens. Runs ON the server, piped over ssh by
# `make tokens`. Resolves each token the way `TokenService` does: `tokens`
# table row first, then the container's env var.
#
# Usage: ssh <host> 'bash -s -- <container>' < scripts/print-tokens.sh
# Output:
#   admin     db   3f9c...
#   settings  env  a71b...

set -euo pipefail

container=$1

# Borrow the app's own DB credentials so this always reads what the app reads.
# libpq takes the JDBC URL minus `jdbc:` and the JDBC-only params it rejects
# (e.g. tcpKeepAlive), keeping sslmode:
# jdbc:postgresql://h:6542/candy?sslmode=require&tcpKeepAlive=true
#   -> postgresql://h:6542/candy?sslmode=require
db_url=$(docker exec "$container" printenv DATABASE_URL)
db_url=${db_url#jdbc:}
sslmode=$(grep -o 'sslmode=[a-z-]*' <<<"$db_url" || true)
db_url=${db_url%%\?*}${sslmode:+?$sslmode}
PGUSER=$(docker exec "$container" printenv DATABASE_USER)
PGPASSWORD=$(docker exec "$container" printenv DATABASE_PASSWORD)
export PGUSER PGPASSWORD

for name in admin settings; do
  # A failed query must stop here: falling back to env would print a token
  # the app no longer accepts
  token=$(psql "$db_url" -qtAX -v ON_ERROR_STOP=1 \
    -c "SELECT value FROM tokens WHERE name = '$name'")
  source=db

  if [ -z "$token" ]; then
    token=$(docker exec "$container" printenv "${name^^}_TOKEN")
    source=env
  fi

  printf '%-9s %-4s %s\n' "$name" "$source" "$token"
done
