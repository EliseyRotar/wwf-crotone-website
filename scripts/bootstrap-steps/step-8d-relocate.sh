#!/usr/bin/env bash
# Move the prod compose + Dockerfile to /srv/wwf/ so context: . finds
# the Dockerfile and the Dockerfile can COPY . . the whole repo via
# ../repo -> /srv/wwf.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step8d failed at line $LINENO"' ERR

cp /srv/wwf/repo/infra/docker-compose.yml /srv/wwf/docker-compose.yml
chmod 0644 /srv/wwf/docker-compose.yml
chown deploy:deploy /srv/wwf/docker-compose.yml

cp /srv/wwf/repo/Dockerfile /srv/wwf/Dockerfile
chmod 0644 /srv/wwf/Dockerfile
chown deploy:deploy /srv/wwf/Dockerfile

echo "--- /srv/wwf/Dockerfile head ---"
head -5 /srv/wwf/Dockerfile
echo "--- /srv/wwf/docker-compose.yml ---"
ls -la /srv/wwf/docker-compose.yml /srv/wwf/Dockerfile

echo DONE
