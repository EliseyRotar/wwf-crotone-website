#!/usr/bin/env bash
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8i failed at line $LINENO"' ERR

cd /srv/wwf
sudo -u deploy docker compose down --remove-orphans 2>&1 | tail -5
sudo docker rmi -f wwf-app:latest 2>&1 | tail -3 || true
sudo -u deploy docker compose up -d --build app postgres redis 2>&1 > /tmp/step-8i.out
sleep 30
log "Container status:"
sudo -u deploy docker compose ps
log "Re-running seed:"
sudo -u deploy docker compose run --rm app sh -c './node_modules/.bin/tsx prisma/seed.ts' 2>&1 | tail -25 || true
echo "--- tables ---"
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf -c '\dt' 2>&1
echo "--- counts ---"
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf -tA -c "SELECT 'turni:' || count(*) FROM \"Turno\" UNION ALL SELECT 'gallery:' || count(*) FROM \"GalleryItem\" UNION ALL SELECT 'user:' || count(*) FROM \"User\";" 2>&1
echo DONE
