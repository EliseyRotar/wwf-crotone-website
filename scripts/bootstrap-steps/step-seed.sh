#!/usr/bin/env bash
# Run prisma seed. The seed.ts needs bcryptjs which is in /app/node_modules
# from the deps stage (npm ci installed it). Let's verify and run.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "seed failed at line $LINENO"' ERR

cd /srv/wwf

# Confirm bcryptjs is in the image
log "Verify bcryptjs in app image:"
sudo -u deploy docker exec wwf-app-1 sh -c 'ls node_modules/bcryptjs 2>&1 | head -3'

log "Run seed..."
sudo -u deploy docker compose run --rm app sh -c './node_modules/.bin/tsx prisma/seed.ts' 2>&1 | tail -20
echo DONE
