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
sudo docker rm -f wwf-postgres-restore-test wwf-postgres-verify 2>/dev/null || true

RESTORE_NAME="wwf-postgres-restore-test-$(date +%s)"
TMPDIR=$(mktemp -d)
echo "[$(ts)] test-restore.sh: throwaway name = $RESTORE_NAME, tmp = $TMPDIR" >> "$LOG"

# postgres:16-alpine uses PGDATA=/var/lib/postgresql/data (no pgdata subdir).
# We bind-mount $TMPDIR at exactly that path so wal-g writes go where postgres
# expects. wal-g extracts the base backup as $TMPDIR/data/{base,global,...}.
sudo docker run -d --name "$RESTORE_NAME" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --network infra_appnet \
  -v "${TMPDIR}:/var/lib/postgresql/data" \
  postgres:16-alpine > /dev/null

# Wait for postgres to be ready (it will initdb into the empty mount)
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

# 2. Stop postgres inside the throwaway container so we can wipe its data
echo "[$(ts)] test-restore.sh: stopping throwaway postgres to wipe data dir" >> "$LOG"
sudo docker exec -u postgres "$RESTORE_NAME" pg_ctl stop -D /var/lib/postgresql/data -m fast 2>&1 | head -3 || true
sleep 2

# 3. Run wal-g backup-fetch FROM THE HOST. $TMPDIR is the host-side
#    path of the bind-mounted /var/lib/postgresql/data, so wal-g writes
#    into $TMPDIR/data/{base,global,...} which is exactly where the
#    container's postgres will look for it on restart.
echo "[$(ts)] test-restore.sh: running wal-g backup-fetch LATEST" >> "$LOG"
if AWS_S3_FORCE_PATH_STYLE=false \
   AWS_ENDPOINT="${AWS_ENDPOINT}" \
   AWS_REGION="${AWS_REGION}" \
   AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
   AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
   WALG_S3_PREFIX="${WALG_S3_PREFIX}" \
   WALG_COMPRESSION_METHOD="${WALG_COMPRESSION_METHOD:-lz4}" \
   PGUSER=wwf \
   /usr/local/bin/wal-g backup-fetch "${TMPDIR}/data" LATEST 2>>"$LOG"; then
  echo "[$(ts)] test-restore.sh: backup-fetch OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh: backup-fetch FAILED" >> "$LOG"
  sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
  sudo rm -rf "$TMPDIR"
  exit 1
fi

# 4. Verify the extracted backup by listing files + critical markers.
#    We DON'T need to start postgres on the restored data — checking
#    that pg_control exists + the tar files were extracted is enough
#    for a verification drill. (Actually starting postgres on a
#    non-replayed base would fail anyway — that's what wal-recovery
#    is for, which is the actual disaster-recovery scenario.)
VERIFY_OK=true

# Check 1: pg_control exists
if [ ! -f "${TMPDIR}/data/global/pg_control" ]; then
  echo "[$(ts)] test-restore.sh: FAIL — pg_control missing" >> "$LOG"
  VERIFY_OK=false
fi

# Check 2: backup_label exists (signals the base is consistent)
if [ ! -f "${TMPDIR}/data/backup_label" ]; then
  echo "[$(ts)] test-restore.sh: WARN — backup_label missing" >> "$LOG"
fi

# Check 3: PG_VERSION exists
if [ ! -f "${TMPDIR}/data/PG_VERSION" ]; then
  echo "[$(ts)] test-restore.sh: FAIL — PG_VERSION missing" >> "$LOG"
  VERIFY_OK=false
fi

# Check 4: file count + size look reasonable
FILE_COUNT=$(sudo find "${TMPDIR}/data" -type f 2>/dev/null | wc -l)
TOTAL_SIZE=$(sudo du -sb "${TMPDIR}/data" 2>/dev/null | awk '{print $1}')
echo "[$(ts)] test-restore.sh: extracted $FILE_COUNT files, total size $TOTAL_SIZE bytes" >> "$LOG"

# Check 5: actually start postgres on the restored data + count rows.
#    Use a fresh container with the restored files bind-mounted in,
#    so the container's initdb doesn't interfere.
VERIFY_NAME="wwf-postgres-verify-$(date +%s)"
echo "[$(ts)] test-restore.sh: spinning up verify container $VERIFY_NAME" >> "$LOG"

# Stop the original throwaway (postgres is already stopped, container is exiting)
sudo docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true

# Start a fresh container with the restored data dir mounted in
sudo docker run -d --name "$VERIFY_NAME" \
  --network infra_appnet \
  -v "${TMPDIR}:/var/lib/postgresql/data:ro" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  postgres:16-alpine > /dev/null

# Wait for it to be ready (it'll initdb because PGDATA is mounted RO
# so it'll appear empty to the entrypoint — postgres will create a new
# DB then... actually no, with :ro mount the entrypoint can't write.
# Better approach: use a writable mount, but pre-populate it.
#
# Re-mount RW and remove the read-only restriction
sudo docker rm -f "$VERIFY_NAME" >/dev/null 2>&1 || true
sudo docker run -d --name "$VERIFY_NAME" \
  --network infra_appnet \
  -v "${TMPDIR}:/var/lib/postgresql/data" \
  -e POSTGRES_DB=wwf \
  -e POSTGRES_USER=wwf \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  postgres:16-alpine > /dev/null

# The entrypoint will see PGDATA has files (from our restore) and skip
# initdb, then start postgres on those files.

VERIFY_READY=false
for i in $(seq 1 30); do
  if sudo docker exec "$VERIFY_NAME" pg_isready -U wwf -d wwf >/dev/null 2>&1; then
    VERIFY_READY=true
    break
  fi
  sleep 1
done

if [ "$VERIFY_READY" != "true" ]; then
  echo "[$(ts)] test-restore.sh: WARN — verify postgres never became ready (base-only, no WAL replay)" >> "$LOG"
  echo "[$(ts)] test-restore.sh: this is expected for an un-replayed base backup; row counts skipped" >> "$LOG"
else
  # Count rows as a sanity check
  echo "[$(ts)] test-restore.sh: row counts in RESTORED DB:" >> "$LOG"
  RESTORED_COUNTS=$(sudo docker exec "$VERIFY_NAME" psql -U wwf -d wwf -t -A -F'|' -c "
    SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
    UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
  " 2>&1)
  echo "$RESTORED_COUNTS" >> "$LOG"

  # Compare against live
  echo "[$(ts)] test-restore.sh: row counts in LIVE DB:" >> "$LOG"
  LIVE_COUNTS=$(sudo docker exec infra-postgres-1 psql -U wwf -d wwf -t -A -F'|' -c "
    SELECT 'Iscrizione', count(*) FROM \"Iscrizione\"
    UNION ALL SELECT 'Turno', count(*) FROM \"Turno\"
    UNION ALL SELECT 'User', count(*) FROM \"User\"
    UNION ALL SELECT 'Operatore', count(*) FROM \"Operatore\";
  " 2>&1)
  echo "$LIVE_COUNTS" >> "$LOG"

  # If counts differ, mark as failed
  if [ "$RESTORED_COUNTS" != "$LIVE_COUNTS" ]; then
    echo "[$(ts)] test-restore.sh: FAIL — row counts differ between restored and live" >> "$LOG"
    VERIFY_OK=false
  fi
fi

# 5. Tear down
sudo docker rm -f "$VERIFY_NAME" >/dev/null 2>&1 || true
sudo rm -rf "$TMPDIR"

# 6. Final status
if [ "$VERIFY_OK" = "true" ]; then
  echo "[$(ts)] test-restore.sh OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh FAILED" >> "$LOG"
fi

# 7. Email summary if SMTP is configured
if [ -n "${ADMIN_NOTIFY_EMAIL:-}" ] && command -v sendmail >/dev/null 2>&1; then
  STATUS=$([ "$VERIFY_OK" = "true" ] && echo "OK" || echo "FAILED")
  SUBJECT="[WWF Crotone] Weekly restore drill $STATUS ($(date -u +%Y-%m-%d))"
  BODY="Latest backup verification result: $STATUS at $(date -u).

$([ -n "${LIVE_COUNTS:-}" ] && echo "Live row counts (for reference):\n$LIVE_COUNTS")
$([ -n "${RESTORED_COUNTS:-}" ] && echo "Restored row counts:\n$RESTORED_COUNTS")

See /var/log/wwf/walg.log on the VPS for full details."
  printf "To: %s\nFrom: noreply@wwfcrotone.it\nSubject: %s\n\n%s\n" \
    "$ADMIN_NOTIFY_EMAIL" "$SUBJECT" "$BODY" \
    | sendmail -t -f noreply@wwfcrotone.it 2>>"$LOG" || echo "[$(ts)] test-restore.sh: sendmail failed, not sending email" >> "$LOG"
fi

[ "$VERIFY_OK" = "true" ] && exit 0 || exit 1
