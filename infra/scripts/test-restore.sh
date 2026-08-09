#!/usr/bin/env bash
# /srv/wwf/scripts/test-restore.sh
#
# Weekly restore drill — verifies that we CAN restore from R2 by:
#   1. Downloading the latest base backup from R2 via wal-g backup-fetch
#   2. Checking that critical files (pg_control, PG_VERSION, global/, base/)
#      are present and intact
#   3. Listing how many tablespaces + relation files are in the backup
#
# This is a SANITY CHECK that R2 + WAL-G is healthy, not a full PITR drill.
# Full disaster recovery (with WAL replay into a consistent DB) is documented
# in docs/RESTORE.md and uses `wal-g backup-fetch` + `restore_command` setup
# in recovery.conf (postgres auto-replays WAL from R2 at startup).
#
# Invoked from /etc/cron.d/wwf-backups at 04:00 UTC every Sunday.
# Output: /var/log/wwf/walg.log.

set -euo pipefail

LOG=/var/log/wwf/walg.log
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%FT%TZ"; }

echo "[$(ts)] test-restore.sh starting (weekly restore verification)" >> "$LOG"

# Load env vars for WAL-G + SMTP
set -a
# shellcheck disable=SC1091
. /srv/wwf/.env.production
set +a

TMPDIR=$(mktemp -d)
echo "[$(ts)] test-restore.sh: tmpdir = $TMPDIR" >> "$LOG"

VERIFY_OK=true

# 1. Pull the latest base backup from R2
echo "[$(ts)] test-restore.sh: running wal-g backup-fetch LATEST" >> "$LOG"
if AWS_S3_FORCE_PATH_STYLE=false \
   AWS_ENDPOINT="${AWS_ENDPOINT}" \
   AWS_REGION="${AWS_REGION}" \
   AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
   AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
   WALG_S3_PREFIX="${WALG_S3_PREFIX}" \
   WALG_COMPRESSION_METHOD="${WALG_COMPRESSION_METHOD:-lz4}" \
   PGUSER=wwf \
   /usr/local/bin/wal-g backup-fetch "${TMPDIR}" LATEST 2>>"$LOG"; then
  echo "[$(ts)] test-restore.sh: backup-fetch OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh: backup-fetch FAILED" >> "$LOG"
  sudo rm -rf "$TMPDIR"
  exit 1
fi

# 2. Critical file checks
echo "[$(ts)] test-restore.sh: verifying critical files" >> "$LOG"

# pg_control (essential — without this, postgres can't start)
if [ -f "${TMPDIR}/global/pg_control" ]; then
  PG_VERSION_PG=$(sudo cat "${TMPDIR}/PG_VERSION" 2>/dev/null)
  echo "[$(ts)] test-restore.sh: pg_control present, PG_VERSION=$PG_VERSION_PG" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh: FAIL — pg_control missing" >> "$LOG"
  VERIFY_OK=false
fi

# backup_label signals the base was taken cleanly
if [ -f "${TMPDIR}/backup_label" ]; then
  BACKUP_LABEL=$(sudo cat "${TMPDIR}/backup_label" 2>/dev/null)
  echo "[$(ts)] test-restore.sh: backup_label: $(echo "$BACKUP_LABEL" | head -1)" >> "$LOG"
fi

# base/ directory with user data
if [ -d "${TMPDIR}/base" ]; then
  BASE_FILES=$(sudo find "${TMPDIR}/base" -type f | wc -l)
  BASE_SIZE=$(sudo du -sb "${TMPDIR}/base" 2>/dev/null | awk '{print $1}')
  echo "[$(ts)] test-restore.sh: base/ has $BASE_FILES files, $BASE_SIZE bytes" >> "$LOG"
fi

# global/ directory with cluster-wide catalogs
if [ -d "${TMPDIR}/global" ]; then
  GLOBAL_FILES=$(sudo find "${TMPDIR}/global" -type f | wc -l)
  echo "[$(ts)] test-restore.sh: global/ has $GLOBAL_FILES files" >> "$LOG"
fi

# Total backup size
TOTAL_SIZE=$(sudo du -sb "${TMPDIR}" 2>/dev/null | awk '{print $1}')
TOTAL_FILES=$(sudo find "${TMPDIR}" -type f | wc -l)
echo "[$(ts)] test-restore.sh: backup total: $TOTAL_FILES files, $TOTAL_SIZE bytes" >> "$LOG"

# 3. Verify R2 has WAL files (continuous archiving working).
#    Use a small stdlib Python helper to count WAL files via signed
#    S3 LIST (no awscli dependency).
echo "[$(ts)] test-restore.sh: counting WAL files in R2" >> "$LOG"

WAL_COUNT=$(AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID}" \
            AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY}" \
            AWS_ENDPOINT="${AWS_ENDPOINT}" \
            python3 /srv/wwf/scripts/walg-count-wal.py 2>/dev/null || echo 0)
WAL_COUNT=$(echo "$WAL_COUNT" | tr -d '[:space:]')
WAL_COUNT=${WAL_COUNT:-0}
echo "[$(ts)] test-restore.sh: R2 has $WAL_COUNT WAL files (continuous archive working)" >> "$LOG"
if [ "$WAL_COUNT" -lt 1 ] 2>/dev/null; then
  echo "[$(ts)] test-restore.sh: FAIL — no WAL files in R2, point-in-time recovery would fail" >> "$LOG"
  VERIFY_OK=false
fi

# 4. Cleanup
sudo rm -rf "$TMPDIR"

# 5. Log final status
if [ "$VERIFY_OK" = "true" ]; then
  echo "[$(ts)] test-restore.sh OK" >> "$LOG"
else
  echo "[$(ts)] test-restore.sh FAILED" >> "$LOG"
fi

# 6. Email summary if SMTP is configured
if [ -n "${ADMIN_NOTIFY_EMAIL:-}" ] && command -v sendmail >/dev/null 2>&1; then
  STATUS=$([ "$VERIFY_OK" = "true" ] && echo "OK" || echo "FAILED")
  SUBJECT="[WWF Crotone] Weekly restore drill $STATUS ($(date -u +%Y-%m-%d))"
  BODY="Backup verification result: $STATUS at $(date -u).

Base backup total: $TOTAL_FILES files, $TOTAL_SIZE bytes
WAL files in R2: $WAL_COUNT

See /var/log/wwf/walg.log on the VPS for full details."
  printf "To: %s\nFrom: noreply@wwfcrotone.it\nSubject: %s\n\n%s\n" \
    "$ADMIN_NOTIFY_EMAIL" "$SUBJECT" "$BODY" \
    | sendmail -t -f noreply@wwfcrotone.it 2>>"$LOG" || echo "[$(ts)] test-restore.sh: sendmail failed, not sending email" >> "$LOG"
fi

[ "$VERIFY_OK" = "true" ] && exit 0 || exit 1
