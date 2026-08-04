#!/usr/bin/env bash
set -Eeuo pipefail
cd /srv/wwf
sudo -u deploy docker compose run --rm app node -e 'console.log("prisma_client:", require("@prisma/client/package.json").version);'
echo "---app node_modules prisma list---"
sudo -u deploy docker compose run --rm app ls node_modules/prisma 2>&1 | head -5
echo "---app node_modules prisma/package.json---"
sudo -u deploy docker compose run --rm app cat node_modules/prisma/package.json 2>&1 | head -10
