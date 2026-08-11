#!/bin/bash
# /srv/wwf/scripts/r2-quota-check.sh — daily R2 free-tier quota check.
# Wrapper that loads the production .env (which has AWS_* and SENTRY_DSN
# already), then invokes the Node script. Logs to /var/log/wwf/r2-quota.log.
set -euo pipefail

# Load the production .env (same one the cron worker uses)
set -a
source /srv/wwf/.env.production
set +a

# Use node directly via the cron worker's image (which has node + prisma client)
docker exec infra-cron-1 sh -c 'cd /tmp && node /scripts/r2-quota-check.js' \
  >> /var/log/wwf/r2-quota.log 2>&1
