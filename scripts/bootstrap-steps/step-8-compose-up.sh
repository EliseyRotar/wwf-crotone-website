#!/usr/bin/env bash
# Step 8 — Run docker compose up -d --build from /srv/wwf/infra.
# Why: compose resolves `context: ../repo` relative to the compose file.
# Here `../repo` = /srv/wwf/repo (correct).
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8 failed at line $LINENO"' ERR

cd /srv/wwf/infra

log "Bring stack up..."
sudo -u deploy docker compose up -d --build 2>&1 | tail -120

echo "--- post-up ps ---"
sudo -u deploy docker compose ps

echo "--- last 40 lines of 'app' logs ---"
sudo -u deploy docker compose logs --tail=40 app || true

echo DONE
