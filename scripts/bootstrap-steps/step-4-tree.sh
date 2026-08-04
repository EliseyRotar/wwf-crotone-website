#!/usr/bin/env bash
# Step 4 — Create /srv/wwf layout, /var/log/wwf, /etc/ssl/cloudflare.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step4 failed at line $LINENO"' ERR

sudo mkdir -p \
  /srv/wwf/nginx/conf.d \
  /srv/wwf/postgres/data \
  /srv/wwf/redis/data \
  /srv/wwf/assets/images \
  /srv/wwf/assets/logos \
  /srv/wwf/assets/downloads \
  /srv/wwf/assets/uploads \
  /srv/wwf/backups \
  /srv/wwf/scripts \
  /srv/wwf/walg \
  /srv/wwf/repo \
  /var/log/wwf \
  /etc/ssl/cloudflare

sudo chown -R deploy:deploy /srv/wwf /var/log/wwf
sudo chmod 0750 /etc/ssl/cloudflare
sudo chmod 0700 /srv/wwf/postgres/data /srv/wwf/redis/data

echo "--- tree ---"
ls -ld /srv/wwf /srv/wwf/*/ /var/log/wwf /etc/ssl/cloudflare 2>&1 | sed 's/^/  /'
echo DONE
