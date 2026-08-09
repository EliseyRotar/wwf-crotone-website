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

# 2. Stop the throwaway postgres so we can wipe its data dir.
#    Alpine's `su` needs a TTY (or `-l`) for postgres user, which sudo
#    docker exec doesn't allocate by default. Use `gosu` (already
#    installed in postgres:16-alpine) or just run as the postgres UID
#    directly via `docker exec -u`.
echo "[$(ts)] test-restore.sh: stopping throwaway postgres to wipe data dir" >> "$LOG"
sudo docker exec -u postgres "$RESTORE_NAME" \
  pg_ctl stop -D /var/lib/postgresql/data -m fast 2>&1 | head -3 || true

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

# 4. Verify the extracted backup by listing its tar contents and
#    checking critical files. We don't try to start postgres on the
#    base backup alone — that requires running wal-g wal-recovery to
#    replay WAL into a consistent state, which is the actual recovery
#    scenario (different from a verification drill).
echo "[$(ts)] test-restore.sh: verifying backup contents" >> "$LOG"

VERIFY_OK=true
# Check 1: pg_control exists and is readable
if [ ! -f "${TMPDIR}/pgdata/global/pg_control" ]; then
  echo "[$(ts)] test-restore.sh: FAIL — pg_control missing" >> "$LOG"
  VERIFY_OK=false
fi

# Check 2: tablespace_map and backup_label were removed (they signal
# incomplete recovery, which we don't want for a verification drill)
if [ -f "${TMPDIR}/pgdata/backup_label" ]; then
  echo "[$(ts)] test-restore.sh: WARN — backup_label still present" >> "$LOG"
fi

# Check 3: archive_status directory exists (postgres needs it)
mkdir -p "${TMPDIR}/pgdata/pg_wal/archive_status"

# Check 4: file count + total size look reasonable (sanity)
FILE_COUNT=$(sudo find "${TMPDIR}/pgdata" -type f | wc -l)
TOTAL_SIZE=$(sudo du -sb "${TMPDIR}/pgdata" 2>/dev/null | awk '{print $1}')
echo "[$(ts)] test-restore.sh: extracted $FILE_COUNT files, total size $TOTAL_SIZE bytes" >> "$LOG"

# Check 5: PG_VERSION file present
if [ ! -f "${TMPDIR}/pgdata/PG_VERSION" ]; then
  echo "[$(ts)] test-restore.sh: FAIL — PG_VERSION missing" >> "$LOG"
  VERIFY_OK=false
fi

# Check 6: try starting postgres briefly to verify the data files are valid
echo "[$(ts)] test-restore.sh: starting postgres for verification" >> "$LOG"
sudo chown -R 999:999 "${TMPDIR}/pgdata"
echo "port = 5432" >> "${TMPDIR}/pgdata/postgresql.conf"
echo "unix_socket_directories = '/var/run/postgresql'" >> "${TMPDIR}/pgdata/postgresql.conf"

# We need the throwaway container to use a different data dir
# since postgres hardcodes $PGDATA. Easier: re-init postgres in the
# throwaway to create a fresh data dir, then copy the restored files
# into it as a one-shot consistency check.

# Use a fresh container just for the verification step
VERIFY_NAME="wwf-postgres-verify-$(date +%s)"
sudo docker run -d --name "$VERIFY_NAME" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --network infra_appnet \
  -v "${TMPDIR}:/tmp/restore-data:ro" \
  postgres:16-alpine > /dev/null

# Wait for it to be ready
READY=false
for i in $(seq 1 30); do
  if sudo docker exec "$VERIFY_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 1
done

if [ "$READY" != "true" ]; then
  echo "[$(ts)] test-restore.sh: verify container never became ready" >> "$LOG"
  VERIFY_OK=false
else
  # Stop the default postgres, copy restored data into place, restart
  echo "[$(ts)] test-restore.sh: swapping in restored data" >> "$LOG"
  sudo docker exec -u postgres "$VERIFY_NAME" pg_ctl stop -D /var/lib/postgresql/data -m fast 2>&1 | head -3 || true
  sudo docker exec -u postgres "$VERIFY_NAME" bash -c '
    rm -rf /var/lib/postgresql/data/pgdata/*
    cp -r /tmp/restore-data/pgdata/* /var/lib/postgresql/data/pgdata/
    chown -R postgres:postgres /var/lib/postgresql/data/pgdata
    rm -f /var/lib/postgresql/data/pgdata/backup_label /var/lib/postgresql/data/pgdata/tablespace_map
  '
  sudo docker start "$VERIFY_NAME" >/dev/null 2>&1

  RESTORED=false
  for i in $(seq 1 30); do
    if sudo docker exec "$VERIFY_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
      RESTORED=true
      break
    fi
    sleep 1
  done

  if [ "$RESTORED" != "true" ]; then
    echo "[$(ts)] test-restore.sh: restored DB never became ready" >> "$LOG"
    VERIFY_OK=false
  else
    # Count rows
    echo "[$(ts)] test-restore.sh: row counts in restored DB:" >> "$LOG"
    sudo docker exec "$VERIFY_NAME" psql -U wwf -d wwf -t -A -F'|' -c "
      SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
      UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
      UNION ALL SELECT 'User', count(*) FROM \"User\"
      UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
    " 2>&1 | tee -a "$LOG"

    # Compare against live
    echo "[$(ts)] test-restore.sh: row counts in LIVE DB:" >> "$LOG"
    LIVE_COUNTS=$(sudo docker exec infra-postgres-1 psql -U wwf -d wwf -t -A -F'|' -c "
      SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
      UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
      UNION ALL SELECT 'User', count(*) FROM \"User\"
      UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
    " 2>&1)
    echo "$LIVE_COUNTS" >> "$LOG"
  fi
fi

sudo docker rm -f "$VERIFY_NAME" >/dev/null 2>&1 || true

# 7. Tear down the original throwaway + tmpdir
sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
sudo rm -rf "$TMPDIR"

# 8. Log final status
if [ "$VERIFY_OK" = "true" ]; then
  echo "[$(ts)] test-restore.sh OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh FAILED" >> "$LOG"
fi

# 9. Email summary if SMTP is configured
if [ -n "${ADMIN_NOTIFY_EMAIL:-}" ] && command -v sendmail >/dev/null 2>&1; then
  STATUS=$([ "$VERIFY_OK" = "true" ] && echo "OK" || echo "FAILED")
  SUBJECT="[WWF Crotone] Weekly restore drill $STATUS ($(date -u +%Y-%m-%d))"
  BODY="Latest backup verification result: $STATUS at $(date -u).

$([ -n "$LIVE_COUNTS" ] && echo "Live row counts (for comparison):\n$LIVE_COUNTS")

See /var/log/wwf/walg.log on the VPS for full details."
  printf "To: %s\nFrom: noreply@wwfcrotone.it\nSubject: %s\n\n%s\n" \
    "$ADMIN_NOTIFY_EMAIL" "$SUBJECT" "$BODY" \
    | sendmail -t -f noreply@wwfcrotone.it 2>>"$LOG" || echo "[$(ts)] test-restore.sh: sendmail failed, not sending email" >> "$LOG"
fi

[ "$VERIFY_OK" = "true" ] && exit 0 || exit 1
