#!/usr/bin/env bash
# Step 10 — install cron stubs and the test-restore script.
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step10 failed at line $LINENO"' ERR

install -d /srv/wwf/scripts
cat > /srv/wwf/scripts/walg-backup.sh <<'EOF'
#!/usr/bin/env bash
# WAL-G daily base backup stub. Wired once R2 bucket + creds are set.
set -e
mkdir -p /var/log/wwf
echo "[$(date -u +%FT%TZ)] walg-backup.sh invoked (stub)" >> /var/log/wwf/walg.log
EOF
cat > /srv/wwf/scripts/walg-wal-push.sh <<'EOF'
#!/usr/bin/env bash
# WAL archive stub.
set -e
mkdir -p /var/log/wwf
echo "[$(date -u +%FT%TZ)] walg-wal-push.sh invoked (stub)" >> /var/log/wwf/walg.log
EOF
chmod 0755 /srv/wwf/scripts/walg-backup.sh /srv/wwf/scripts/walg-wal-push.sh
chown -R deploy:deploy /srv/wwf/scripts

sudo tee /etc/cron.d/wwf-backups >/dev/null <<'EOF'
# /etc/cron.d/wwf-backups — installed by bootstrap-vps.ps1
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

0 3 * * *  deploy  /srv/wwf/scripts/walg-backup.sh  >> /var/log/wwf/walg.log 2>&1
* * * * *  deploy  /srv/wwf/scripts/walg-wal-push.sh >> /var/log/wwf/walg.log 2>&1
0 4 * * 0  deploy  /srv/wwf/scripts/test-restore.sh  >> /var/log/wwf/walg.log 2>&1
EOF
sudo chmod 0644 /etc/cron.d/wwf-backups

log "Cron installed at /etc/cron.d/wwf-backups"
log "WAL-G scripts in /srv/wwf/scripts/"
ls -la /srv/wwf/scripts/ /etc/cron.d/wwf-backups
echo DONE
