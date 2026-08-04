#!/usr/bin/env bash
# Step 3 — Install Docker Engine + Compose plugin.
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step3 failed at line $LINENO"' ERR

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh > /tmp/docker-install.log 2>&1
  log "Docker engine installed ($(docker --version 2>/dev/null || echo unknown))"
fi
systemctl is-active docker >/dev/null || sudo systemctl enable --now docker

sudo usermod -aG docker deploy

docker --version
docker compose version
log "deploy added to docker group (re-login required to take effect, but sudo -u deploy docker works)"
echo DONE
