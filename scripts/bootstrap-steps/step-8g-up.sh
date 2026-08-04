#!/usr/bin/env bash
# Final build attempt.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8g failed at line $LINENO"' ERR

cd /srv/wwf

log "Tear down..."
sudo -u deploy docker compose down --remove-orphans 2>&1 | tail -10 || true
sudo docker rmi -f wwf-app:latest 2>&1 | tail -3 || true

log "Bring stack up (rebuild)..."
sudo -u deploy docker compose up -d --build 2>&1 > /tmp/step-8g.out
echo "--- post-up ps ---"
sudo -u deploy docker compose ps
echo DONE
