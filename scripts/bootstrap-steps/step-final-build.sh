#!/usr/bin/env bash
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step-final-build failed at line $LINENO"' ERR

cd /srv/wwf
sudo -u deploy docker compose down --remove-orphans 2>&1 | tail -3
sudo docker rmi -f wwf-app:latest 2>&1 | tail -3 || true
sudo -u deploy docker compose up -d --build app postgres redis 2>&1 > /tmp/step-final-build.out
echo "Done. Sleeping 30s..."
sleep 30
log "Container status:"
sudo -u deploy docker compose ps
