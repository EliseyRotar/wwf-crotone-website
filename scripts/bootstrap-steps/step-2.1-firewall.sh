#!/usr/bin/env bash
set -Eeuo pipefail
log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "step2.1 failed at line $LINENO"' ERR

# ufw must be run as root (uses iptables)
if ! sudo ufw status | grep -q 'Status: active'; then
  sudo ufw --force reset >/dev/null
  sudo ufw --force default deny incoming
  sudo ufw --force default allow outgoing
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
  log "UFW enabled (22,80,443)"
else
  log "UFW already active — ensuring rules"
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
fi

sudo ufw status verbose || true
sudo systemctl is-active fail2ban || sudo systemctl enable --now fail2ban
log "fail2ban: $(sudo systemctl is-active fail2ban)"

# Verify we didn't lock SSH out
ss -tnlp | grep -E ':22\b' || { err 'sshd not listening'; exit 1; }
log "sshd listening on port 22"
echo DONE
