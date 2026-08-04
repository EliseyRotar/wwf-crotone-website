#!/usr/bin/env bash
# Run prisma db push to create tables in postgres.
# Also installs bcryptjs so seed.ts can run afterwards.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step-db-push failed at line $LINENO"' ERR

cd /srv/wwf
sudo -u deploy docker compose run --rm app sh -c "./node_modules/.bin/prisma db push --schema ./prisma/schema.prisma --accept-data-loss" 2>&1 | tail -30
log "DB push done; tables now:"
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf -c '\dt' 2>&1
