#!/usr/bin/env bash
# Step 5 — Clone the WWF Crotone repo into /srv/wwf/repo.
# Idempotent: skips if repo already present.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step5 failed at line $LINENO"' ERR

if [ -d /srv/wwf/repo/.git ]; then
  log "repo already present at /srv/wwf/repo"
  cd /srv/wwf/repo
  git fetch --all --prune || true
  git log --oneline -1
else
  cd /srv/wwf
  git clone https://github.com/EliseyRotar/wwf-crotone-website.git repo
  log "cloned into /srv/wwf/repo"
fi

chown -R deploy:deploy /srv/wwf/repo
ls -la /srv/wwf/repo | head -25
echo "--- HEAD ---"
git -C /srv/wwf/repo log --oneline -3 || echo "git log failed"
echo DONE
