#!/usr/bin/env bash
# Step 1.2 — Harden sshd: keys only, root from keys only, allow users root+deploy.
# Idempotent: detects whether drop-in exists, applies when missing.
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

NEW_ROOT_PW='__NEW_ROOT_PW__'
DEPLOY_PUBKEY='__DEPLOY_PUBKEY__'
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step1.2 failed at line $LINENO"' ERR

# Create deploy user + key
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
  log "deploy user created"
else
  log "deploy user already present"
fi
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
if [ ! -f /home/deploy/.ssh/authorized_keys ]; then
  touch /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys \
  || printf '\n# admin dev box\n%s\n' "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
log "deploy authorized_keys has our pubkey"

# sudoers
echo 'deploy ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/deploy
chmod 0440 /etc/sudoers.d/deploy
log "sudoers.d/deploy installed (NOPASSWD)"

# Root pubkey was already installed in step 1.1 (verify)
grep -qF "$DEPLOY_PUBKEY" /root/.ssh/authorized_keys \
  || { printf '\n%s\n' "$DEPLOY_PUBKEY" >> /root/.ssh/authorized_keys; log "added pubkey to root"; }

# Rotate root password
echo "root:${NEW_ROOT_PW}" | chpasswd
log "root password rotated"

# Hardening drop-in
if [ ! -f /etc/ssh/sshd_config.d/99-wwf.conf ]; then
  install -d /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/99-wwf.conf <<'EOF'
PermitRootLogin prohibit-password
PasswordAuthentication no
ChallengeResponseAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
UsePAM yes
AllowUsers root deploy
X11Forwarding no
PrintMotd no
EOF
  log "drop-in 99-wwf.conf installed"
else
  log "drop-in 99-wwf.conf already present, skipping"
fi

# Belt-and-braces: also clear conflicting defaults in main sshd_config
sed -i -E 's/^[[:space:]]*#?[[:space:]]*PasswordAuthentication[[:space:]].*/PasswordAuthentication no/' /etc/ssh/sshd_config || true
sed -i -E 's/^[[:space:]]*#?[[:space:]]*KbdInteractiveAuthentication[[:space:]].*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config || true

# Test config and reload
sshd -t
systemctl reload ssh
log "sshd reloaded with hardened config"

# Autoremove apt-listchanges from /etc/apt/apt.conf.d/ later if not needed
echo "ROOT_PW=${NEW_ROOT_PW}"
echo "DONE"
