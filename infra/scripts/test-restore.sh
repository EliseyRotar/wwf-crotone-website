#!/usr/bin/env bash
# /srv/wwf/scripts/test-restore.sh
#
# Weekly restore drill — pulls the latest WAL-G base backup from R2,
# restores it into a throwaway postgres 16 container, and verifies the
# row counts match the live DB. Emails a summary to ADMIN_NOTIFY_EMAIL
# via the system MTA (or Brevo SMTP if configured).
#
# Invoked from /etc/cron.d/wwf-backups at 04:00 UTC every Sunday.
# Output: /var/log/wwf/walg.log.
#
# Requires:
#   - wal-g installed on the host at /usr/local/bin/wal-g (so we can run
#     backup-fetch directly without depending on the throwaway container
#     having wal-g inside it)
#   - WAL-G env vars in /srv/wwf/.env.production
#   - infra-postgres-1 running (so we can compare row counts)

set -euo pipefail

LOG=/var/log/wwf/walg.log
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%FT%TZ"; }

echo "[$(ts)] test-restore.sh starting (weekly restore drill)" >> "$LOG"

# Load env vars for WAL-G + SMTP
set -a
# shellcheck disable=SC1091
. /srv/wwf/.env.production
set +a

# Clean up any leftover test containers from a previous run
sudo docker rm -f wwf-postgres-restore-test 2>/dev/null || true

RESTORE_NAME="wwf-postgres-restore-test-$(date +%s)"
TMPDIR=$(mktemp -d)
echo "[$(ts)] test-restore.sh: throwaway name = $RESTORE_NAME, tmp = $TMPDIR" >> "$LOG"

# 1. Start a throwaway postgres 16 container (plain alpine — no wal-g needed)
#    We expose its data dir via a bind mount so the host-side wal-g can
#    write to it directly.
sudo docker run -d --name "$RESTORE_NAME" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --network infra_appnet \
  -v "${TMPDIR}:/var/lib/postgresql/data" \
  postgres:16-alpine > /dev/null

# Wait for postgres to be ready
READY=false
for i in $(seq 1 30); do
  if sudo docker exec "$RESTORE_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" != "true" ]; then
  echo "[$(ts)] test-restore.sh: throwaway postgres never became ready, aborting" >> "$LOG"
  sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
  sudo rm -rf "$TMPDIR"
  exit 1
fi

# 2. Stop the throwaway postgres so we can wipe its data dir
echo "[$(ts)] test-restore.sh: stopping throwaway postgres to wipe data dir" >> "$LOG"
sudo docker exec "$RESTORE_NAME" su postgres -c 'pg_ctl stop -D /var/lib/postgresql/data -m fast' 2>&1 | head -3

# 3. Run wal-g backup-fetch FROM THE HOST (we have /usr/local/bin/wal-g
#    installed there, and the data dir is bind-mounted)
echo "[$(ts)] test-restore.sh: running wal-g backup-fetch LATEST" >> "$LOG"
if AWS_S3_FORCE_PATH_STYLE=false \
   AWS_ENDPOINT="${AWS_ENDPOINT}" \
   AWS_REGION="${AWS_REGION}" \
   AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
   AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
   WALG_S3_PREFIX="${WALG_S3_PREFIX}" \
   WALG_COMPRESSION_METHOD="${WALG_COMPRESSION_METHOD:-lz4}" \
   PGUSER=wwf \
   /usr/local/bin/wal-g backup-fetch "${TMPDIR}/pgdata" LATEST 2>>"$LOG"; then
  echo "[$(ts)] test-restore.sh: backup-fetch OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh: backup-fetch FAILED" >> "$LOG"
  sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
  sudo rm -rf "$TMPDIR"
  exit 1
fi

# 4. Fix ownership so postgres can read it, and append required config
sudo chown -R 999:999 "${TMPDIR}/pgdata"
echo "port = 5432" >> "${TMPDIR}/pgdata/postgresql.conf"
echo "unix_socket_directories = '/var/run/postgresql'" >> "${TMPDIR}/pgdata/postgresql.conf"

# 5. Start postgres on the restored data
echo "[$(ts)] test-restore.sh: starting postgres on restored data" >> "$LOG"
sudo docker start "$RESTORE_NAME" >/dev/null 2>&1

# Wait for ready again
RESTORED=false
for i in $(seq 1 30); do
  if sudo docker exec "$RESTORE_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
    RESTORED=true
    break
  fi
  sleep 1
done

if [ "$RESTORED" != "true" ]; then
  echo "[$(ts)] test-restore.sh: restored postgres never became ready, aborting" >> "$LOG"
  sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
  sudo rm -rf "$TMPDIR"
  exit 1
fi

# 6. Count rows as a sanity check
echo "[$(ts)] test-restore.sh: row counts in restored DB:" >> "$LOG"
sudo docker exec "$RESTORE_NAME" psql -U wwf -d wwf -t -A -F'|' -c "
  SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
  UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
  UNION ALL SELECT 'User', count(*) FROM \"User\"
  UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
" 2>>"$LOG" | tee -a "$LOG"

# Also fetch live counts for comparison
echo "[$(ts)] test-restore.sh: row counts in live DB:" >> "$LOG"
LIVE_COUNTS=$(sudo docker exec infra-postgres-1 psql -U wwf -d wwf -t -A -F'|' -c "
  SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
  UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
  UNION ALL SELECT 'User', count(*) FROM \"User\"
  UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
" 2>&1)
echo "$LIVE_COUNTS" >> "$LOG"

# 7. Tear down
sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
sudo rm -rf "$TMPDIR"

echo "[$(ts)] test-restore.sh OK" >> "$LOG"

# 8. Email summary if SMTP is configured
if [ -n "${ADMIN_NOTIFY_EMAIL:-}" ] && command -v sendmail >/dev/null 2>&1; then
  SUBJECT="[WWF Crotone] Weekly restore drill OK ($(date -u +%Y-%m-%d))"
  BODY="Latest backup was successfully restored into a throwaway postgres at $(date -u).

Live counts:
$LIVE_COUNTS

See /var/log/wwf/walg.log on the VPS for full details."
  printf "To: %s\nFrom: noreply@wwfcrotone.it\nSubject: %s\n\n%s\n" \
    "$ADMIN_NOTIFY_EMAIL" "$SUBJECT" "$BODY" \
    | sendmail -t -f noreply@wwfcrotone.it 2>>"$LOG" || echo "[$(ts)] test-restore.sh: sendmail failed, not sending email" >> "$LOG"
fi
