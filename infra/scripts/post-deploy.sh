#!/usr/bin/env bash
# =============================================================================
# post-deploy.sh — Runs after every GitHub Actions deploy on the VPS.
#   1. Smoke test (calls /api/health on localhost through nginx)
#   2. Confirm all app containers are healthy
#   3. Tail the last 50 lines of the app container's logs
#   4. Print a human-readable summary (and exit non-zero on failure so the
#      `deploy` job in GitHub Actions fails loudly)
#
# Run from anywhere on the VPS:  /srv/wwf/scripts/post-deploy.sh
# =============================================================================

set -euo pipefail

APP_DIR="/srv/wwf"
LOG_DIR="/var/log/wwf"
COMPOSE="docker compose"
HEALTH_URL="http://localhost/api/health"
SMOKE_URLS=(
  "/"
  "/it"
  "/en"
  "/it/dates"
  "/it/contact"
  "/it/faq"
  "/api/health"
)

cd "$APP_DIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[+]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[x]${NC} $*" >&2; }
head() { echo -e "\n${BLUE}=== $* ===${NC}"; }

FAILED=0

# -----------------------------------------------------------------------------
# 1. Health check
# -----------------------------------------------------------------------------
head "Health check on $HEALTH_URL"
HTTP=$(curl -sk -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
if [ "$HTTP" = "200" ]; then
  ok "Health: 200 OK"
else
  err "Health: $HTTP — aborting smoke tests"
  FAILED=1
fi

# -----------------------------------------------------------------------------
# 2. Smoke test the public surfaces
# -----------------------------------------------------------------------------
head "Smoke test (public pages)"
if [ "$FAILED" -eq 0 ]; then
  for path in "${SMOKE_URLS[@]}"; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" "http://localhost${path}" || echo "000")
    if [ "$code" = "200" ]; then
      ok "$path -> $code"
    else
      err "$path -> $code"
      FAILED=1
    fi
  done
else
  warn "Skipped (health check already failed)"
  FAILED=1
fi

# -----------------------------------------------------------------------------
# 3. Container health
# -----------------------------------------------------------------------------
head "Container health"
mapfile -t STATUS < <("$COMPOSE" ps --format '{{.Service}}\t{{.Status}}\t{{.Health}}' 2>/dev/null || true)
if [ "${#STATUS[@]}" -eq 0 ]; then
  err "docker compose ps returned no rows — is the stack up?"
  FAILED=1
else
  for line in "${STATUS[@]}"; do
    svc=$(printf '%s' "$line" | awk -F'\t' '{print $1}')
    stat=$(printf '%s' "$line" | awk -F'\t' '{print $2}')
    health=$(printf '%s' "$line" | awk -F'\t' '{print $3}')
    if [ "$health" = "(healthy)" ] || [ "$health" = "" ]; then
      ok "$svc — $stat $health"
    else
      warn "$svc — $stat $health"
      FAILED=1
    fi
  done
fi

# -----------------------------------------------------------------------------
# 4. App log tail
# -----------------------------------------------------------------------------
head "Last 50 lines of app container logs"
"$COMPOSE" logs --tail=50 app || true

# -----------------------------------------------------------------------------
# 5. Summary
# -----------------------------------------------------------------------------
head "Summary"
APP_IMG=$("$COMPOSE" images app --format '{{.Repository}}:{{.Tag}} ({{.ID}})' 2>/dev/null | head -1 || echo "unknown")
PG_SIZE=$(docker exec wwf-postgres psql -U wwf -d wwf -tA -c \
  "SELECT pg_size_pretty(pg_database_size('wwf'));" 2>/dev/null | tr -d ' ' || echo "n/a")

if [ "$FAILED" -eq 0 ]; then
  ok "Post-deploy checks passed."
  echo "  Image : $APP_IMG"
  echo "  DB    : $PG_SIZE"
  exit 0
else
  err "Post-deploy checks FAILED — see output above."
  echo "  Image : $APP_IMG"
  echo "  DB    : $PG_SIZE"
  echo "  Logs  : $LOG_DIR  (and 'docker compose logs -f app')"
  exit 1
fi
