#!/usr/bin/env bash
# /srv/wwf/scripts/walg-backup.sh
#
# Daily base backup of the postgres database to Cloudflare R2 via WAL-G.
# Invoked from /etc/cron.d/wwf-backups at 03:00 UTC. All output goes to
# /var/log/wwf/walg.log.
#
# Requires:
#   - WALG_* env vars in /srv/wwf/.env.production
#   - wwf-postgres image with wal-g installed (infra/postgres.Dockerfile)
#   - infra-postgres-1 container running

set -euo pipefail

LOG=/var/log/wwf/walg.log
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%FT%TZ"; }

echo "[$(ts)] walg-backup.sh starting (daily base backup)" >> "$LOG"

# Load env vars for WAL-G (AWS_* etc.)
set -a
# shellcheck disable=SC1091
. /srv/wwf/.env.production
set +a

# Run the backup from inside the postgres container, where wal-g is installed.
# PGHOST defaults to /var/run/postgresql inside the container which is
# what wal-g needs (it uses libpq / psql-style connection).
docker exec \
  -e WALG_S3_PREFIX \
  -e AWS_ENDPOINT \
  -e AWS_REGION \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_S3_FORCE_PATH_STYLE=false \
  -e WALG_COMPRESSION_METHOD \
  -e WALG_DELTA_MAX_STEPS \
  -e PGHOST=/var/run/postgresql \
  infra-postgres-1 \
  wal-g backup-push /var/lib/postgresql/data/pgdata 2>>"$LOG"

rc=$?
if [ "$rc" -eq 0 ]; then
  echo "[$(ts)] walg-backup.sh OK" >> "$LOG"
else
  echo "[$(ts)] walg-backup.sh FAILED (exit $rc)" >> "$LOG"
fi
exit "$rc"
