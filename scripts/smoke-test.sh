#!/usr/bin/env bash
# Post-deploy smoke test — runs on the VPS right after `docker compose up -d
# --build app && docker compose restart nginx`. Hits critical public surfaces
# through the local Nginx (port 80) and exits non-zero on any 4xx/5xx so the
# GitHub Actions deploy job fails loudly instead of shipping a broken image.
#
# Run from anywhere on the VPS:    /srv/wwf/scripts/smoke-test.sh
# Or from CI:                      ssh deploy@vps '/srv/wwf/scripts/smoke-test.sh'

set -euo pipefail

echo "Running smoke tests..."

# (path, expected_status). Most should be 200; /api/health returns 200 on
# healthy DB and 503 if Postgres is unreachable, so 200 confirms the whole
# stack is up. 404 is acceptable only on /api/health if the DB is up but
# the route is missing — but in practice /api/health is always 200 or 503.
declare -a TARGETS=(
  "/"
  "/it"
  "/en"
  "/api/health"
  "/it/dates"
  "/it/contact"
  "/it/faq"
)

FAILED=0
for path in "${TARGETS[@]}"; do
  code=$(curl -sk -o /dev/null -w "%{http_code}" "http://localhost${path}")
  printf "  %-20s -> %s\n" "$path" "$code"
  if [ "$code" != "200" ]; then
    echo "  FAILED: ${path} returned ${code}"
    FAILED=1
  fi
done

if [ "$FAILED" -ne 0 ]; then
  echo "Smoke tests FAILED"
  exit 1
fi

echo "All smoke tests passed"
