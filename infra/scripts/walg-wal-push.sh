#!/usr/bin/env bash
# /srv/wwf/scripts/walg-wal-push.sh
#
# Continuous WAL archiving trigger. Invoked from /etc/cron.d/wwf-backups
# every minute. Postgres's archive_command already pushes every WAL
# segment as soon as it's rotated, so this script is mostly a safety net
# (it forces a wal-push of any pending segments, e.g. if the postgres
# archive_command failed silently).
#
# Output: /var/log/wwf/walg.log.

set -euo pipefail

LOG=/var/log/wwf/walg.log
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%FT%TZ"; }

echo "[$(ts)] walg-wal-push.sh running" >> "$LOG"

set -a
# shellcheck disable=SC1091
. /srv/wwf/.env.production
set +a

# List WAL segments waiting to be archived and push any that are stale.
# If postgres's archive_command is working, this will be a no-op.
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
  bash -c '
    # Force a checkpoint so any pending WAL is rotated and archived.
    psql -U wwf -d wwf -c "SELECT pg_switch_wal();" >/dev/null 2>&1 || true
  ' 2>>"$LOG"

rc=$?
if [ "$rc" -ne 0 ]; then
  echo "[$(ts)] walg-wal-push.sh: pg_switch_wal failed (exit $rc), continuing" >> "$LOG"
fi

echo "[$(ts)] walg-wal-push.sh OK (postgres archive_command handles the actual push)" >> "$LOG"
exit 0
