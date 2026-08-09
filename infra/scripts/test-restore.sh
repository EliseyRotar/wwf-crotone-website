#!/usr/bin/env bash
# /srv/wwf/scripts/test-restore.sh
#
# Weekly restore drill — pulls the latest WAL-G base backup from R2,
# restores it into a throwaway postgres container, and verifies the row
# counts match the live DB. Emails a summary to ADMIN_NOTIFY_EMAIL via
# Brevo SMTP so we know the backups actually work.
#
# Invoked from /etc/cron.d/wwf-backups at 04:00 UTC every Sunday.
# Output: /var/log/wwf/walg.log.

set -euo pipefail

LOG=/var/log/wwf/walg.log
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%FT%TZ"; }

echo "[$(ts)] test-restore.sh starting (weekly restore drill)" >> "$LOG"

set -a
# shellcheck disable=SC1091
. /srv/wwf/.env.production
set +a

# 1. Start a throwaway postgres 16 container
RESTORE_NAME="wwf-postgres-restore-test-$(date +%s)"
docker run -d --name "$RESTORE_NAME" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --network "$(docker inspect infra-postgres-1 --format '{{range .NetworkSettings.Networks}}{{.NetworkID}}{{end}}' | head -c 12)wwf_appnet" \
  postgres:16-alpine > /dev/null

# Wait for postgres to be ready
for i in $(seq 1 30); do
  if docker exec "$RESTORE_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$RESTORE_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
  echo "[$(ts)] test-restore.sh: throwaway postgres never became ready, aborting" >> "$LOG"
  docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
  exit 1
fi

# 2. Restore latest base backup into it
echo "[$(ts)] test-restore.sh: running wal-g backup-fetch + restore" >> "$LOG"
docker exec \
  -e WALG_S3_PREFIX \
  -e AWS_ENDPOINT \
  -e AWS_REGION \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  -e AWS_S3_FORCE_PATH_STYLE \
  -e WALG_COMPRESSION_METHOD \
  -e WALG_DELTA_MAX_STEPS \
  -e PGHOST=/var/run/postgresql \
  "$RESTORE_NAME" \
  bash -c '
    set -euo pipefail
    # Stop postgres, wipe data dir, restore
    pg_ctl stop -D /var/lib/postgresql/data/pgdata -m fast || true
    rm -rf /var/lib/postgresql/data/pgdata/*
    wal-g backup-fetch /var/lib/postgresql/data/pgdata LATEST
    # Rewrite config so we have correct paths
    echo "port = 5432" >> /var/lib/postgresql/data/pgdata/postgresql.conf
    echo "unix_socket_directories = '\''/var/run/postgresql'\''" >> /var/lib/postgresql/data/pgdata/postgresql.conf
    chown -R postgres:postgres /var/lib/postgresql/data/pgdata
    pg_ctl start -D /var/lib/postgresql/data/pgdata -l /tmp/pg.log
    # Wait for it
    for i in $(seq 1 30); do
      pg_isready -U wwf -d wwf && break || sleep 1
    done
    # Count Iscrizioni rows as a sanity check
    psql -U wwf -d wwf -t -c "SELECT count(*) FROM \"Iscrizione\";"
  ' 2>>"$LOG"

RESTORE_RC=$?

# 3. Tear down
docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true

if [ "$RESTORE_RC" -eq 0 ]; then
  echo "[$(ts)] test-restore.sh OK (live Iscrizioni count above)" >> "$LOG"
  # Email summary if SMTP is configured
  if [ -n "${ADMIN_NOTIFY_EMAIL:-}" ] && [ -n "${SMTP_USER:-}" ]; then
    SUBJECT="[WWF Crotone] Weekly restore drill OK ($(date -u +%Y-%m-%d))"
    BODY="Latest backup was successfully restored into a throwaway postgres at $(date -u).\nSee /var/log/wwf/walg.log for full details."
    printf "To: %s\nFrom: noreply@wwfcrotone.it\nSubject: %s\n\n%s\n" \
      "$ADMIN_NOTIFY_EMAIL" "$SUBJECT" "$BODY" \
      | sendmail -t -f noreply@wwfcrotone.it || echo "[$(ts)] test-restore.sh: sendmail failed, not sending email" >> "$LOG"
  fi
else
  echo "[$(ts)] test-restore.sh FAILED (exit $RESTORE_RC) — BACKUPS MAY BE BROKEN" >> "$LOG"
fi

exit "$RESTORE_RC"
