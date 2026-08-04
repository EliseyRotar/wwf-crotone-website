#!/usr/bin/env bash
# Step 9 — Stage nginx configs into /srv/wwf/nginx and create empty
# Cloudflare Origin cert placeholders. Patch the prod docker-compose so
# its build context points to ../repo (since infra/docker-compose.yml
# would otherwise fail to find the Dockerfile).
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step9 failed at line $LINENO"' ERR

cd /srv/wwf
sudo -u deploy install -m 0644 repo/infra/nginx/nginx.conf        nginx/nginx.conf
sudo -u deploy install -m 0644 repo/infra/nginx/conf.d/app.conf   nginx/conf.d/app.conf

# Patch infra/docker-compose.yml: build context must be ../repo because
# the Dockerfile lives at the repo root, while the compose file lives in
# infra/. Adjust context and dockerfile path.
F=/srv/wwf/repo/infra/docker-compose.yml
if ! grep -q 'context: \./repo' "$F"; then
  sed -i -E 's|([[:space:]]*context:[[:space:]]*)\.$|\1./repo|g; s|([[:space:]]*dockerfile:[[:space:]]*)Dockerfile$|\1../Dockerfile|g' "$F"
  log "patched $F (build context -> ./repo, dockerfile -> ../Dockerfile)"
else
  log "$F already patched"
fi

echo "--- nginx configs ---"
ls -la /srv/wwf/nginx /srv/wwf/nginx/conf.d

echo "--- prod compose build block ---"
grep -E -B0 -A3 'build:|context:|dockerfile:' "$F" | head -20

# Cloudflare Origin cert placeholders (operator will replace)
sudo install -d /etc/ssl/cloudflare
sudo touch /etc/ssl/cloudflare/cert.pem
sudo touch /etc/ssl/cloudflare/key.pem
sudo chown root:root /etc/ssl/cloudflare/cert.pem
sudo chown root:root /etc/ssl/cloudflare/key.pem
sudo chmod 0644 /etc/ssl/cloudflare/cert.pem
sudo chmod 0600 /etc/ssl/cloudflare/key.pem
# Also place a convenience copy at /srv/wwf for the operator's scp
sudo -u deploy touch /srv/wwf/cert.pem
sudo -u deploy touch /srv/wwf/key.pem
sudo -u deploy chmod 0600 /srv/wwf/cert.pem /srv/wwf/key.pem
ls -la /srv/wwf/{cert,key}.pem /etc/ssl/cloudflare/{cert,key}.pem
echo DONE
