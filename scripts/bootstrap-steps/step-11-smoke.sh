#!/usr/bin/env bash
# Step 11 — Run smoke-test against the app container.
# We hit the app directly via docker exec since nginx needs certs.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step11 failed at line $LINENO"' ERR

declare -a TARGETS=(
  "/"
  "/it"
  "/en"
  "/api/health"
  "/it/dates"
  "/it/contact"
  "/it/faq"
)

FAILS=0
for p in "${TARGETS[@]}"; do
  CODE=$(sudo -u deploy docker exec wwf-app-1 sh -c "wget -q -O - --header='Host: localhost' http://127.0.0.1:3000${p} -S 2>&1 | grep -E '^  HTTP' | awk '{print \$2}'" 2>&1)
  if [ "$CODE" = "200" ]; then
    log "$p -> $CODE"
  else
    err "$p -> $CODE"
    FAILS=$((FAILS+1))
  fi
done
echo "FAILS=$FAILS"

if [ "$FAILS" -gt 0 ]; then
  echo "--- last app logs ---"
  sudo -u deploy docker compose logs app --tail=30
  exit 1
fi
echo DONE
