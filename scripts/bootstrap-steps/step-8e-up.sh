#!/usr/bin/env bash
# Final step 8 — bring up the stack from /srv/wwf/.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8e failed at line $LINENO"' ERR

cd /srv/wwf
log "Bringing stack up from $(pwd)"
sudo -u deploy docker compose up -d --build 2>&1 | tail -80
echo "--- post-up status ---"
sudo -u deploy docker compose ps
echo DONE
