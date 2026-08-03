#!/usr/bin/env bash
# =============================================================================
# test-restore.sh — Weekly drill that proves we can actually restore.
#   1. Pull the latest WAL-G base backup from Cloudflare R2.
#   2. Spin up a throwaway postgres:16 container.
#   3. Restore into it + run `pg_dump --schema-only` to verify integrity.
#   4. Email the result to wwfcrotone26@gmail.com (or print to stdout).
#   5. Tear down the throwaway container.
#
# Cron: every Sunday 04:00 UTC, see /etc/cron.d/wwf-backups.
# Env:  WAL-G + R2 credentials come from /srv/wwf/.env.production.
# =============================================================================

set -euo pipefail

APP_DIR="/srv/wwf"
LOG_DIR="/var/log/wwf"
NOTIFY_EMAIL="wwfcrotone26@gmail.com"
TMP_DIR="$(mktemp -d -t wwf-restore-XXXXXX)"
THROWAWAY_NAME="wwf-restore-drill-$$"
THROWAWAY_PORT="55432"
THROWAWAY_DB="wwf_drill"
THROWAWAY_USER="drill"
THROWAWAY_PASS="drill_$(openssl rand -hex 6)"

mkdir -p "$LOG_DIR"
REPORT="$LOG_DIR/restore-drill.log"

log()  { echo "[$(date -u +%FT%TZ)] $*" | tee -a "$REPORT"; }
fail() { log "FAILED: $*"; cleanup; notify "FAIL" "$*"; exit 1; }

cleanup() {
  log "Tearing down throwaway container…"
  docker rm -f "$THROWAWAY_NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

notify() {
  local status="$1" body="$2"
  local subject="[WWF restore-drill] $status @ $(hostname -s) $(date -u +%FT%TZ)"
  if command -v mail >/dev/null 2>&1; then
    echo "$body" | mail -s "$subject" "$NOTIFY_EMAIL" || true
  else
    log "mail(1) not available — printing summary instead:"
    printf '\n--- %s ---\n%s\n---\n' "$subject" "$body"
  fi
}

# -----------------------------------------------------------------------------
# 0. Pre-flight
# -----------------------------------------------------------------------------
[ -f "$APP_DIR/.env.production" ] || fail "Missing $APP_DIR/.env.production"
# shellcheck disable=SC1090
set -a; . "$APP_DIR/.env.production"; set +a
: "${WALG_S3_PREFIX:?WALG_S3_PREFIX not set in .env.production}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID not set}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY not set}"

command -v wal-g >/dev/null 2>&1 || fail "wal-g binary not found on PATH"
command -v docker >/dev/null 2>&1 || fail "docker not found"

log "Drill started in $TMP_DIR (container: $THROWAWAY_NAME)"

# -----------------------------------------------------------------------------
# 1. Pull latest base backup metadata from R2
# -----------------------------------------------------------------------------
log "Fetching latest base backup from $WALG_S3_PREFIX …"
LATEST=$(wal-g backup-list --json 2>/dev/null | jq -r '.[0].backup_name' || true)
[ -n "$LATEST" ] && [ "$LATEST" != "null" ] || fail "No base backups found in R2"
log "Latest base backup: $LATEST"

# -----------------------------------------------------------------------------
# 2. Throwaway postgres container
# -----------------------------------------------------------------------------
log "Starting throwaway postgres:16 on port $THROWAWAY_PORT …"
docker run -d --name "$THROWAWAY_NAME" \
  -e POSTGRES_DB="$THROWAWAY_DB" \
  -e POSTGRES_USER="$THROWAWAY_USER" \
  -e POSTGRES_PASSWORD="$THROWAWAY_PASS" \
  -p "${THROWAWAY_PORT}:5432" \
  postgres:16-alpine >/dev/null

# Wait for ready
for i in {1..30}; do
  if docker exec "$THROWAWAY_NAME" pg_isready -U "$THROWAWAY_USER" >/dev/null 2>&1; then
    log "Postgres is ready (after ${i}s)."
    break
  fi
  sleep 1
  [ "$i" -eq 30 ] && fail "Postgres did not become ready in 30s"
done

# -----------------------------------------------------------------------------
# 3. Restore + verify with pg_dump --schema-only
# -----------------------------------------------------------------------------
export PGPASSWORD="$THROWAWAY_PASS"
export PGHOST=127.0.0.1 PGPORT="$THROWAWAY_PORT" PGUSER="$THROWAWAY_USER" PGDATABASE="$THROWAWAY_DB"

log "Running wal-g backup-fetch $LATEST …"
wal-g backup-fetch "$LATEST" \
  --target-user="$THROWAWAY_USER" \
  --target-database="$THROWAWAY_DB" \
  --target-tmp-dir="$TMP_DIR" >>"$REPORT" 2>&1 \
  || fail "wal-g backup-fetch failed (see $REPORT)"

log "Restoring with pg_restore …"
# Find the first .tar file from WAL-G and stream it in
TAR=$(ls -1 "$TMP_DIR"/basebackups_005/"$LATEST"/tar_partitions/*.tar 2>/dev/null | head -1 || true)
[ -n "$TAR" ] || fail "No tar_partitions found under $TMP_DIR"
pg_restore --no-owner --no-privileges --single-transaction --exit-on-error \
  --dbname="$THROWAWAY_DB" "$TAR" >>"$REPORT" 2>&1 \
  || fail "pg_restore failed (see $REPORT)"

log "Verifying with pg_dump --schema-only …"
SCHEMA_DUMP=$(pg_dump --schema-only "$THROWAWAY_DB" 2>>"$REPORT" || true)
[ -n "$SCHEMA_DUMP" ] || fail "pg_dump --schema-only produced empty output"
TABLES=$(printf '%s' "$SCHEMA_DUMP" | grep -c '^CREATE TABLE' || true)
log "Restore OK — schema dump contains $TABLES CREATE TABLE statements."

# -----------------------------------------------------------------------------
# 4. Notify
# -----------------------------------------------------------------------------
SUMMARY=$(cat <<EOF
Restore drill: SUCCESS
Server       : $(hostname -f) ($(hostname -I | awk '{print $1}'))
Backup used  : $LATEST
Tables seen  : $TABLES
Full log     : $REPORT
EOF
)
log "$SUMMARY"
notify "OK" "$SUMMARY"
