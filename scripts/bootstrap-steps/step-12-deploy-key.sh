#!/usr/bin/env bash
# Step 12 — Generate the deploy SSH keypair for CI/CD.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step12 failed at line $LINENO"' ERR

sudo -u deploy bash -c '
set -e
mkdir -p ~/.ssh
if [ ! -f ~/.ssh/wwf_deploy ]; then
  ssh-keygen -t ed25519 -N "" -f ~/.ssh/wwf_deploy -C "wwf-crotone-deploy"
  log "keypair generated"
else
  log "keypair already exists"
fi
cat ~/.ssh/wwf_deploy.pub >> ~/.ssh/authorized_keys
chmod 0600 ~/.ssh/authorized_keys
'

echo "=== PRIVATE KEY (paste into GitHub Secrets VPS_SSH_KEY) ==="
sudo -u deploy cat /home/deploy/.ssh/wwf_deploy
echo
echo "=== PUBLIC KEY ==="
sudo -u deploy cat /home/deploy/.ssh/wwf_deploy.pub
echo DONE
