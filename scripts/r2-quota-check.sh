#!/bin/bash
# /srv/wwf/scripts/r2-quota-check.sh — daily R2 free-tier quota check.
# Wrapper that loads the production .env (which has AWS_* and SENTRY_DSN
# already), then invokes the Node script. Logs to /var/log/wwf/r2-quota.log.
set -euo pipefail

# Load the production .env (same one the cron worker uses)
set -a
# shellcheck disable=SC1091
source /srv/wwf/.env.production
set +a

# Use the cron worker's image (which has Node + prisma client baked in)
# via the bound mount (scripts/r2-quota-check.js is mounted at /scripts/).
docker exec infra-cron-1 node /scripts/r2-quota-check.js \
  >> /var/log/wwf/r2-quota.log 2>&1