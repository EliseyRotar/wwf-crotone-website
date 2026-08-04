#!/usr/bin/env bash
set -Eeuo pipefail
cd /srv/wwf
echo "--- compose ps ---"
sudo -u deploy docker compose ps
echo "--- seed ---"
sudo -u deploy docker compose run --rm app sh -c './node_modules/.bin/tsx prisma/seed.ts' 2>&1 | tail -25
echo "--- counts ---"
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf -tA -c 'SELECT ''turni:''||count(*) FROM "Turno";' 2>&1
sudo -u deploy docker exec wwf-postgres-1 psql -U wwf -d wwf -tA -c 'SELECT ''gallery:''||count(*) FROM "GalleryItem";' 2>&1
echo DONE
