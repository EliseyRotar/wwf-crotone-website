#!/usr/bin/env bash
# Step 7 — Scaffold /srv/wwf/.env.production from the example.
# Generated values:
#   POSTGRES_PASSWORD — random 32 chars
#   AUTH_SECRET       — random 48 chars (base64)
# TODO placeholders remain for SMTP_USER/SMTP_PASS/AWS_*/SENTRY/BREVO keys
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step7 failed at line $LINENO"' ERR

cd /srv/wwf

# Generate strong secrets locally
DBPW=$(openssl rand -base64 24 | tr -d '\n=+/' | head -c 32)
SECRET=$(openssl rand -base64 48)
GROQ_KEY='gsk_REPLACE_WITH_YOUR_GROQ_API_KEY_FROM_console_groq_com_keys'
ADMIN_EMAIL='wwfcrotone26@gmail.com'
NEXTPUB_URL='https://wwfcrotone.it'
NEXTPUB_PLAUSIBLE='wwfcrotone.it'

cp repo/infra/.env.production.example .env.production
chmod 600 .env.production
chown deploy:deploy .env.production

# Substitute known values; leave TODOs for the user
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DBPW}|" .env.production
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env.production
sed -i "s|^NEXT_PUBLIC_SITE_URL=.*|NEXT_PUBLIC_SITE_URL=${NEXTPUB_URL}|" .env.production
sed -i "s|^NEXT_PUBLIC_PLAUSIBLE_DOMAIN=.*|NEXT_PUBLIC_PLAUSIBLE_DOMAIN=${NEXTPUB_PLAUSIBLE}|" .env.production
sed -i "s|^GROQ_API_KEY=.*|GROQ_API_KEY=${GROQ_KEY}|" .env.production
sed -i "s|^ADMIN_NOTIFY_EMAIL=.*|ADMIN_NOTIFY_EMAIL=${ADMIN_EMAIL}|" .env.production
# Mark TODO placeholders for the operator
sed -i "s|^SMTP_USER=.*|SMTP_USER=TODO_brevo_smtp_user|" .env.production
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=TODO_brevo_smtp_key|"  .env.production
sed -i "s|^AWS_ENDPOINT=.*|AWS_ENDPOINT=https://TODO_accountid.r2.cloudflarestorage.com|" .env.production
sed -i "s|^AWS_REGION=.*|AWS_REGION=auto|" .env.production
sed -i "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=TODO_r2_access_key|" .env.production
sed -i "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=TODO_r2_secret|" .env.production

echo "--- .env.production (redacted) ---"
sed -E 's/(PASSWORD|SECRET|KEY|PASS|TOKEN|TODO)=[^=]*(.*)/\1=***REDACTED***/g; s/(EMAIL)=[^=]*(.*)/\1=***REDACTED***/g' .env.production | head -30
echo "---"
chmod 600 .env.production
chown deploy:deploy .env.production
echo "DBPW=${DBPW}"
echo "SECRET=${SECRET}"
echo DONE
