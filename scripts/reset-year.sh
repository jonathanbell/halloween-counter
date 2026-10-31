#!/usr/bin/env bash
# Wipe one year's events before the night starts: test taps, votes, effects
# and game scores. Runs ON the server, piped over ssh by `make reset-year`,
# which asks for confirmation between the two modes.
#
# Usage: ssh <host> 'bash -s -- <container> <year> count|delete' < scripts/reset-year.sh
#   count   print the year's rows by type and its count adjustment
#   delete  in one transaction: zero the year's count adjustment, delete its
#           events and write the deleted rows to stdout as CSV (the backup)
#
# Settings (candy supply, vote options), tokens and other years stay.

set -euo pipefail

container=$1
year=$2
mode=$3

if [[ ! $year =~ ^[0-9]{4}$ ]]; then
  echo "Bad year: $year" >&2
  exit 1
fi

# Same credential borrowing as print-tokens.sh: the app's own DATABASE_URL,
# minus `jdbc:` and the JDBC-only params libpq rejects, keeping sslmode
db_url=$(docker exec "$container" printenv DATABASE_URL)
db_url=${db_url#jdbc:}
sslmode=$(grep -o 'sslmode=[a-z-]*' <<<"$db_url" || true)
db_url=${db_url%%\?*}${sslmode:+?$sslmode}
PGUSER=$(docker exec "$container" printenv DATABASE_USER)
PGPASSWORD=$(docker exec "$container" printenv DATABASE_PASSWORD)
export PGUSER PGPASSWORD

run() {
  psql "$db_url" -qX -v ON_ERROR_STOP=1 "$@"
}

case $mode in
  count)
    run -c "SELECT type, COUNT(*) AS rows FROM events WHERE \"year\" = $year GROUP BY type ORDER BY type" \
        -c "SELECT count_adjustment FROM settings WHERE \"year\" = $year"
    ;;

  delete)
    # -1 commits both or neither. RETURNING makes the backup exactly the
    # rows deleted, even if someone taps mid-reset
    run -1 \
      -c "UPDATE settings SET count_adjustment = 0 WHERE \"year\" = $year" \
      -c "COPY (DELETE FROM events WHERE \"year\" = $year RETURNING *) TO STDOUT WITH CSV HEADER"
    ;;

  *)
    echo "Unknown mode: $mode" >&2
    exit 1
    ;;
esac
