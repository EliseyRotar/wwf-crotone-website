#!/usr/bin/env bash
# Fix the build context path. The compose file is at infra/docker-compose.yml
# so './repo' resolves to infra/repo (does not exist). The repo is at the
# parent, so we need '../repo'.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
F=/srv/wwf/repo/infra/docker-compose.yml
sudo -u deploy sed -i 's|context: \./repo|context: ../repo|' "$F"
echo "--- fixed block ---"
grep -B1 -A4 'context:' "$F"
echo DONE
