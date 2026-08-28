#!/usr/bin/env bash
# =============================================================================
# bootstrap-vps.sh — One-time VPS bootstrap for the WWF Crotone website.
# Target: Contabo Cloud VPS 4 (4 vCPU / 8 GB / 100 GB SSD, Ubuntu 24.04).
# Run as root from a fresh image. Idempotent: safe to re-run.
# =============================================================================

set -euo pipefail

# -----------------------------------------------------------------------------
# Style helpers
# -----------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()    { echo -e "${GREEN}[+]${NC} $*"; }
warn()   { echo -e "${YELLOW}[!]${NC} $*"; }
err()    { echo -e "${RED}[x]${NC} $*" >&2; }
header() { echo -e "\n${BLUE}=== $* ===${NC}"; }

trap 'err "Bootstrap failed on line $LINENO. Aborting."; exit 1' ERR

# Pre-flight: must be root
if [ "$EUID" -ne 0 ]; then
  err "Please run as root (e.g. via sudo bash bootstrap-vps.sh)."
  exit 1
fi

DEPLOY_USER="deploy"
APP_DIR="/srv/wwf"
REPO_URL="https://github.com/EliseyRotar/wwf-crotone-website.git"
LOG_DIR="/var/log/wwf"
SSL_DIR="/etc/ssl/cloudflare"

# -----------------------------------------------------------------------------
# 1. OS updates + base packages
# -----------------------------------------------------------------------------
header "Updating OS + installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get -y upgrade
apt-get -y install --no-install-recommends \
  ufw fail2ban unattended-upgrades \
  curl wget git nano htop jq unzip ca-certificates gnupg lsb-release apt-transport-https
log "Base packages installed."

# -----------------------------------------------------------------------------
# 2. Firewall + fail2ban
# -----------------------------------------------------------------------------
header "Configuring UFW + fail2ban"
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable fail2ban --now >/dev/null
log "UFW active (22, 80, 443) and fail2ban running."

# -----------------------------------------------------------------------------
# 3. Unattended security upgrades
# -----------------------------------------------------------------------------
header "Configuring unattended-upgrades (security only)"
dpkg-reconfigure -f noninteractive -plow unattended-upgrades >/dev/null
# Ensure security origin is enabled; keep -updates/-proposed disabled
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Download-Upgradeable-Packages "1";
EOF
log "Nightly security patches scheduled."

# -----------------------------------------------------------------------------
# 4. deploy user (no root for app work)
# -----------------------------------------------------------------------------
header "Creating '$DEPLOY_USER' user"
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi
install -d -m 0700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
echo "deploy ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/deploy
chmod 0440 /etc/sudoers.d/deploy
log "User '$DEPLOY_USER' ready (sudo NOPASSWD)."

# -----------------------------------------------------------------------------
# 5. Docker Engine + Compose plugin
# -----------------------------------------------------------------------------
header "Installing Docker Engine"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null
fi
usermod -aG docker "$DEPLOY_USER"
docker compose version | awk '{print "  docker compose:", $0}'
log "Docker installed; '$DEPLOY_USER' added to docker group (re-login required)."

# -----------------------------------------------------------------------------
# 6. Directory tree under /srv/wwf
# -----------------------------------------------------------------------------
header "Creating /srv/wwf tree"
mkdir -p \
  "$APP_DIR/nginx/conf.d" \
  "$APP_DIR/postgres/data" \
  "$APP_DIR/redis/data" \
  "$APP_DIR/assets/images" \
  "$APP_DIR/assets/logos" \
  "$APP_DIR/assets/downloads" \
  "$APP_DIR/assets/uploads" \
  "$APP_DIR/backups" \
  "$APP_DIR/scripts" \
  "$APP_DIR/walg" \
  "$APP_DIR/repo"
mkdir -p "$LOG_DIR" "$SSL_DIR"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR" "$LOG_DIR"
chmod 0750 "$SSL_DIR"

# Copy static assets from repo to asset dirs (Nginx serves these directly
# via /srv/wwf/assets/{images,logos,downloads,uploads} — see nginx/conf.d/app.conf).
# Without this step, /logos/wwf.png and /images/* return 404.
if [ -d "$APP_DIR/repo/public" ]; then
  cp -rn "$APP_DIR/repo/public/logos/"* "$APP_DIR/assets/logos/" 2>/dev/null || true
  cp -rn "$APP_DIR/repo/public/images/"* "$APP_DIR/assets/images/" 2>/dev/null || true
  cp -rn "$APP_DIR/repo/public/downloads/"* "$APP_DIR/assets/downloads/" 2>/dev/null || true
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/assets"
  log_ok "Static assets seeded from repo/public/"
else
  warn "repo/public not found; skipping asset seed (will 404 until copied)"
fi
log "Directories created under $APP_DIR and $LOG_DIR."

# -----------------------------------------------------------------------------
# 7. Clone the repo
# -----------------------------------------------------------------------------
header "Cloning repo into $APP_DIR/repo"
if [ ! -d "$APP_DIR/repo/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR/repo"
else
  warn "Repo already present, skipping clone."
fi
log "Repo at $APP_DIR/repo ($(sudo -u "$DEPLOY_USER" git -C "$APP_DIR/repo" rev-parse --short HEAD))."

# -----------------------------------------------------------------------------
# 8. Copy infra files into /srv/wwf
# -----------------------------------------------------------------------------
header "Copying infra files into $APP_DIR"
sudo -u "$DEPLOY_USER" cp -r "$APP_DIR/repo/infra/." "$APP_DIR/"
sudo -u "$DEPLOY_USER" cp "$APP_DIR/repo/infra/.env.production.example" \
  "$APP_DIR/.env.production.example" 2>/dev/null || true
# Stage helper scripts from infra/scripts and scripts/ for live use
sudo -u "$DEPLOY_USER" install -m 0755 \
  "$APP_DIR/repo/infra/scripts/post-deploy.sh" "$APP_DIR/scripts/post-deploy.sh" 2>/dev/null || true
sudo -u "$DEPLOY_USER" install -m 0755 \
  "$APP_DIR/repo/infra/scripts/test-restore.sh" "$APP_DIR/scripts/test-restore.sh" 2>/dev/null || true
sudo -u "$DEPLOY_USER" install -m 0755 \
  "$APP_DIR/repo/scripts/smoke-test.sh" "$APP_DIR/scripts/smoke-test.sh" 2>/dev/null || true
log "infra/ copied to $APP_DIR and helper scripts installed in $APP_DIR/scripts/."

# -----------------------------------------------------------------------------
# 9. Cron jobs (WAL-G backup + weekly test-restore)
# -----------------------------------------------------------------------------
header "Installing cron jobs"
CRON_FILE="/etc/cron.d/wwf-backups"
cat > "$CRON_FILE" <<'EOF'
# /etc/cron.d/wwf-backups — installed by bootstrap-vps.sh
# Nightly base backup to Cloudflare R2 (03:00 UTC)
0 3 * * *  deploy  /srv/wwf/scripts/backup.sh >> /var/log/wwf/backup.log 2>&1
# WAL archive every minute
* * * * *  deploy  /srv/wwf/scripts/wal-archive.sh >> /var/log/wwf/wal.log 2>&1
# Weekly restore drill (Sunday 04:00 UTC)
0 4 * * 0  deploy  /srv/wwf/scripts/test-restore.sh >> /var/log/wwf/restore.log 2>&1
EOF
chmod 0644 "$CRON_FILE"

# Re-point cron at the real WAL-G scripts shipped in the repo:
#   infra/scripts/walg-backup.sh  →  /srv/wwf/scripts/backup.sh
#   infra/scripts/walg-wal-push.sh →  /srv/wwf/scripts/wal-archive.sh
# (the previous bootstrap created a stub `backup.sh` and a stub
# `wal-archive.sh`, which meant nightly base backups and WAL archiving
# were both no-ops in production). Idempotent: only overwrites if the
# stub placeholder is in place, never destroys a hand-edited script.
install_walg_script() {
  local src="$1" dst="$2"
  if [ ! -f "$APP_DIR/repo/$src" ]; then
    return 0
  fi
  if [ -f "$APP_DIR/scripts/$dst" ] \
      && ! grep -q 'not implemented yet' "$APP_DIR/scripts/$dst"; then
    return 0
  fi
  sudo -u "$DEPLOY_USER" install -m 0755 "$APP_DIR/repo/$src" "$APP_DIR/scripts/$dst"
  log "Linked $src → scripts/$dst"
}

install_walg_script "infra/scripts/walg-backup.sh"  "backup.sh"
install_walg_script "infra/scripts/walg-wal-push.sh" "wal-archive.sh"

# Final fallback: if the cron entry points at a non-existent script,
# install a loud stub that exits non-zero so we get a mail instead of
# silent data loss.
for s in backup.sh wal-archive.sh; do
  if [ ! -f "$APP_DIR/scripts/$s" ]; then
    echo '#!/usr/bin/env bash' | sudo -u "$DEPLOY_USER" tee "$APP_DIR/scripts/$s" >/dev/null
    echo "echo \"FATAL: $s is missing — bootstrap did not link walg-*.sh from repo/infra/scripts/\" >&2" \
      | sudo -u "$DEPLOY_USER" tee -a "$APP_DIR/scripts/$s" >/dev/null
    echo "exit 1" | sudo -u "$DEPLOY_USER" tee -a "$APP_DIR/scripts/$s" >/dev/null
    sudo -u "$DEPLOY_USER" chmod 0755 "$APP_DIR/scripts/$s"
    err "Installed loud-failure stub for $s — check bootstrap log."
  fi
done
log "Cron jobs installed: $CRON_FILE"

# -----------------------------------------------------------------------------
# 10. Summary
# -----------------------------------------------------------------------------
header "Bootstrap complete — next steps"
PUB_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
SSH_FP=$(ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null | awk '{print $2}')

cat <<EOF
${GREEN}Server ready.${NC}

  Public IP : ${PUB_IP:-unknown}
  SSH host key (ed25519) : ${SSH_FP:-unknown}
  App dir    : ${APP_DIR}        (owner: ${DEPLOY_USER})
  Log dir    : ${LOG_DIR}
  SSL dir    : ${SSL_DIR}

Next steps (as $DEPLOY_USER):
  1. Authorize your key:
       sudo -u $DEPLOY_USER bash -c 'echo "ssh-ed25519 AAAA… your-key" >> /home/$DEPLOY_USER/.ssh/authorized_keys'
       sudo -u $DEPLOY_USER chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
  2. Drop the Cloudflare Origin cert:
       # cert.pem → ${SSL_DIR}/cert.pem    (chmod 644)
       # key.pem  → ${SSL_DIR}/key.pem     (chmod 600)
  3. Fill ${APP_DIR}/.env.production from ${APP_DIR}/.env.production.example
       cp ${APP_DIR}/.env.production.example ${APP_DIR}/.env.production
       nano ${APP_DIR}/.env.production
       chmod 600 ${APP_DIR}/.env.production
  4. Bring the stack up:
       cd ${APP_DIR} && docker compose up -d --build
       cd ${APP_DIR} && bash scripts/smoke-test.sh
EOF
