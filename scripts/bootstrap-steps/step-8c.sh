#!/usr/bin/env bash
# Step 8 (final) — bring the stack up from /srv/wwf/repo/infra.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8 failed at line $LINENO"' ERR

cd /srv/wwf/repo/infra
log "Bringing stack up from $(pwd) (compose file uses context: ../repo)"
sudo -u deploy docker compose up -d --build 2>&1 | tail -60
echo "--- post-up status ---"
sudo -u deploy docker compose ps
echo DONE
