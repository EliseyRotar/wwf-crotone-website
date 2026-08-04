#!/usr/bin/env bash
# Drop the broken wwf-app image and re-run compose up.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8f failed at line $LINENO"' ERR

cd /srv/wwf
log "Tear down any half-up stack..."
sudo -u deploy docker compose down --remove-orphans 2>&1 | tail -10 || true
sudo docker rmi -f wwf-app:latest 2>&1 || true
sudo -u deploy docker builder prune -f 2>&1 | tail -3 || true

log "Bring stack up (full rebuild)..."
sudo -u deploy docker compose up -d --build 2>&1 | tail -100 > /tmp/step-8f.out
echo "--- post-up status ---"
sudo -u deploy docker compose ps
echo DONE
