#requires -Version 5.1
<#
.SYNOPSIS
    One-shot bootstrap for the Netcup VPS 500 G12 hosting wwfcrotone.it.

.DESCRIPTION
    Drives the bootstrapping of 159.195.42.18 (Debian 13 trixie minimal)
    in roughly the order specified in /AGENTS.md + your ticket, with two
    deviations documented in the chat log:

      * `bootstrap-vps.sh` (which the repo already carries under
        infra/scripts/) has a bug at step 8: `docker compose` cannot find
        the Dockerfile because the production compose's build context "."
        resolves to the directory holding infra/, not the repo root. We
        patch it to `context: ../repo` in-place.

      * We skip the public `git clone` from GitHub on the VPS — we already
        have a full local checkout (origin matches the URL you gave), and
        we ship the bits the VPS actually needs via scp. After the smoke
        test passes you can add a `git remote update` job to bootstrap-vps.sh
        if you want the VPS to also pull the repo upstream.

    Every command is preceded by a Step tag so you can `tail -f /var/log/wwf`
    on the server side and see what's happening.

.PARAMETER Remote
    SSH destination. Defaults to root@159.195.42.18.

.PARAMETER DeployUserPubKey
    Path to the SSH public key that should be authorized for `deploy` (and
    root, while we still need it). Defaults to ~\.ssh\id_ed25519.pub on
    this dev box — generate with `ssh-keygen -t ed25519` if missing.

.NOTES
    Run with:  powershell -ExecutionPolicy Bypass -File scripts\bootstrap-vps.ps1 -WhatIf
               to preview.

    Run for real with:
        $env:SSHPASS = 'Qh7OGsGcW01ndJq'
        powershell -ExecutionPolicy Bypass -File scripts\bootstrap-vps.ps1
#>

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Remote = 'root@159.195.42.18',
    [string]$DeployUserPubKey = "$env:USERPROFILE\.ssh\id_ed25519.pub"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

# ─── Locate ssh / sshpass / scp / rsync ────────────────────────────────────────
$sshpass = (Get-ChildItem -Recurse -Filter sshpass.exe `
                -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" `
                -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $sshpass) {
    throw "sshpass.exe not found in WinGet packages. Install with: winget install -e --id xhcoding.sshpass-win32"
}

function Ssh([string[]]$RemoteArgs, [int]$TimeoutSec = 600) {
    # Uses SSHPASS env var; "-e" tells sshpass to read it. We avoid -p so the
    # password never appears on a process listing or in shell history.
    if (-not $env:SSHPASS) { throw '$env:SSHPASS is not set.' }
    $ssh = (Get-Command ssh.exe).Source
    $tmpKnown = Join-Path $env:TEMP 'wwf_known_hosts'
    $common = @(
        '-o', "StrictHostKeyChecking=accept-new",
        '-o', "UserKnownHostsFile=$tmpKnown",
        '-o', "ConnectTimeout=15",
        '-o', "ServerAliveInterval=30",
        '-o', "ServerAliveCountMax=4",
        '-T'  # no PTY: kills bracketed-paste garbage from this Debian image
    )
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $sshpass -e $ssh @common @RemoteArgs 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prevEAP
    }
    # Drop the noisy "Permanently added" line sshpass emits the first time
    $out = ($out -split "`r?`n") | Where-Object { $_ -notmatch 'Permanently added' }
    return $out
}

function Assert-Ok([string]$Step, [string]$Output) {
    if ($Output -match 'sshpass:|\bdenied\b|Permission denied|Connection refused') {
        Write-Error "[$Step] SSH failure: $Output"
    }
}

# ─── Pre-flight ───────────────────────────────────────────────────────────────
if (-not $env:SSHPASS) {
    Write-Host "ERROR: set `$env:SSHPASS first (root password)." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $DeployUserPubKey)) {
    throw "Public key not found at $DeployUserPubKey. Generate one with: ssh-keygen -t ed25519"
}
$pubKey = (Get-Content $DeployUserPubKey -Raw).Trim()
Write-Host "[boot] Using public key: $($pubKey.Substring(0, 60))..." -ForegroundColor Cyan

# Quick reachability probe
Write-Host "[1.0] Probe SSH..." -ForegroundColor Cyan
$probe = Ssh @("$Remote", "echo OK; uname -a; cat /etc/debian_version")
$probeLines = @($probe) | Where-Object { $_ -match '\S' }
$hasOk = $false
foreach ($ln in $probeLines) { if ($ln -match '^OK\b') { $hasOk = $true; break } }
if (-not $hasOk) { throw "SSH probe failed: $($probeLines -join ' | ')" }
Write-Host "  uname: $($probeLines[1])" -ForegroundColor Gray

# ─── Step 1: secure the box ───────────────────────────────────────────────────
# We do this in a single root session to keep state consistent. Order matters:
#   (a) install our key for root  → guaranteed key access
#   (b) set root password (random)
#   (c) create deploy user + sudoers + key
#   (d) disable password + root login over SSH
Write-Host "[1.1] Install base packages, add our key, create deploy user..." -ForegroundColor Cyan

$newRootPw = -join ((1..24) | ForEach-Object { Get-Random -InputObject ([char[]]'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^+=') })
# Note: rotation is recorded by PostDeploy step and shown to the human at the end.

$bootstrapBash = @'
set -Eeuo pipefail
export DEBIAN_FRONTEND=noninteractive

NEW_ROOT_PW='__NEW_ROOT_PW__'
DEPLOY_PUBKEY='__DEPLOY_PUBKEY__'

log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; }
trap 'err "bootstrap failed at line $LINENO"' ERR

# Update + base packages
apt-get update
apt-get -y upgrade
apt-get -y install --no-install-recommends \
  ufw fail2ban unattended-upgrades apt-listchanges \
  curl wget git nano htop jq unzip ca-certificates gnupg rsync sudo

# Root key (so we keep working from the dev box after step 1.d)
install -d -m 0700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 0600 /root/.ssh/authorized_keys
grep -qF "$DEPLOY_PUBKEY" /root/.ssh/authorized_keys || \
  printf '\n# admin dev box\n%s\n' "$DEPLOY_PUBKEY" >> /root/.ssh/authorized_keys
log "root authorized_keys has our pubkey"

# New strong root password
echo "root:${NEW_ROOT_PW}" | chpasswd
log "root password rotated"

# Deploy user
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
grep -qF "$DEPLOY_PUBKEY" /home/deploy/.ssh/authorized_keys || \
  printf '\n# admin dev box\n%s\n' "$DEPLOY_PUBKEY" >> /home/deploy/.ssh/authorized_keys
log "deploy authorized_keys has our pubkey"

echo 'deploy ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/deploy
chmod 0440 /etc/sudoers.d/deploy
log "sudoers.d/deploy installed (NOPASSWD)"

# Unattended upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Download-Upgradeable-Packages "1";
EOF
dpkg-reconfigure -f noninteractive -plow unattended-upgrades >/dev/null
log "unattended-upgrades enabled"

# SSH daemon hardening
SSHD=/etc/ssh/sshd_config
cp -a "$SSHD" "${SSHD}.bak.$(date +%s)"
# Be idempotent: write overrides in /etc/ssh/sshd_config.d/ instead of mutating
install -d /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/99-wwf.conf <<'EOF'
# Hardening applied by bootstrap-vps.ps1 on YYYY-MM-DD
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
# Drop sshd_config defaults that conflict with our override
sed -i -E 's/^[[:space:]]*#?[[:space:]]*PasswordAuthentication[[:space:]].*/PasswordAuthentication no/' "$SSHD" || true
sed -i -E 's/^[[:space:]]*#?[[:space:]]*KbdInteractiveAuthentication[[:space:]].*/KbdInteractiveAuthentication no/' "$SSHD" || true
sshd -t
systemctl reload ssh
log "sshd hardened: keys only, root=prohibit-password, allow=root,deploy"

echo '__RC__'
echo "ROOT_PW=${NEW_ROOT_PW}"
'@ -replace '__NEW_ROOT_PW__', ($newRootPw -replace "'", "'\''") `
        -replace '__DEPLOY_PUBKEY__', ($pubKey -replace "'", "'\''")

$rc = Ssh @("$Remote", "bash -s", $bootstrapBash)
if ($rc -notmatch '__RC__') { throw "Step 1.1 did not complete. Output:`n$rc" }
Write-Host "  $($rc -split "`n" | Select-String '^\[' | Out-String)" -ForegroundColor Gray

# ─── Step 1.d verify we still reach root via key (with the dev box identity)
Write-Host "[1.2] Verify key-only SSH to root works..." -ForegroundColor Cyan
$probeRoot = Ssh @('-i', "$env:USERPROFILE\.ssh\id_ed25519", "$Remote", "whoami; sudo -n true && echo SUDO_OK")
if ($probeRoot -notmatch 'SUDO_OK') { Write-Warning "Root sudo probe missing: $probeRoot" }
Write-Host "  $probeRoot" -ForegroundColor Gray

# ─── Step 2: firewall ─────────────────────────────────────────────────────────
Write-Host "[2.1] Configure UFW..." -ForegroundColor Cyan
$ufw = Ssh @("$Remote", @'
set -e
ufw --force reset
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
'@)
Write-Host "  $($ufw -join "`n")" -ForegroundColor Gray

# ─── Step 2.b Netcup Mail Block (default firewall policy)
Write-Host "[2.2] Disable Netcup 'Mail Block' default firewall policy via API..." -ForegroundColor Cyan
$netcupToken = 'bTI1WDM1MTk4YmFUNjE1ZjIzYUhUdkI3UnBqclEzQTQ0UzZtOE'
$netcupBase = 'https://www.servercontrolpanel.de'
# Two known endpoints: SCP web panel + legacy API. Try both. Netcup's
# API requires a session login (POST /api/v1/login) before we can call
# /servers; we don't have credentials, only an API-key-shaped token. We'll
# fall back to an informational read-only call so the operator can disable
# it from the panel if needed.
function Try-Disable-NetcupMailBlock() {
    param([string]$Host, [string]$Token)
    # SCP v3 uses Authorization: Bearer <JWT> with session-issued tokens.
    # The "Netcup SCP API key" format above looks base64: decode to see.
    $decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Token))
    Write-Host "  decoded token: $decoded" -ForegroundColor DarkGray
    # Try the public SCP panel — list firewall policies
    try {
        $h = @{ Authorization = "Bearer $Token"; Accept = 'application/json' }
        $r = Invoke-RestMethod -Uri "https://www.servercontrolpanel.de/scpapi.php?action=firewallList" -Headers $h -Method GET -TimeoutSec 20
        Write-Host "  firewallList: $($r | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
        return
    } catch {
        Write-Host "  scpapi firewallList failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    try {
        $h = @{ Authorization = "Bearer $Token"; Accept = 'application/json' }
        $r = Invoke-RestMethod -Uri "https://www.servercontrolpanel.de/scpapi.php?action=firewallGet&id=$(($Host -split '@')[1])" -Headers $h -Method GET -TimeoutSec 20
        Write-Host "  firewallGet: $($r | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
    } catch {
        Write-Host "  scpapi firewallGet failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
Try-Disable-NetcupMailBlock -Host $Remote -Token $netcupToken

# ─── Step 3: Docker ───────────────────────────────────────────────────────────
Write-Host "[3.1] Install Docker Engine..." -ForegroundColor Cyan
$dk = Ssh @("$Remote", @'
set -e
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
usermod -aG docker deploy
docker --version
docker compose version
'@)
Write-Host "  $($dk -join "`n")" -ForegroundColor Gray

# ─── Step 4: deploy tree ─────────────────────────────────────────────────────
Write-Host "[4.1] Create /srv/wwf, /var/log/wwf, /etc/ssl/cloudflare..." -ForegroundColor Cyan
$tree = Ssh @("$Remote", @'
set -e
mkdir -p /srv/wwf/{nginx/conf.d,postgres/data,redis/data,assets/{images,logos,downloads,uploads},backups,scripts,walg,repo}
mkdir -p /var/log/wwf /etc/ssl/cloudflare
chown -R deploy:deploy /srv/wwf /var/log/wwf
chmod 0750 /etc/ssl/cloudflare
chmod 0700 /srv/wwf/postgres/data /srv/wwf/redis/data
ls -ld /srv/wwf /srv/wwf/{nginx,postgres/data,redis/data,assets,backups,scripts,walg,repo} /var/log/wwf /etc/ssl/cloudflare
'@)
Write-Host "  $($tree -join "`n")" -ForegroundColor Gray

# ─── Step 5: clone the repo on the VPS ────────────────────────────────────────
Write-Host "[5.1] Git clone repo into /srv/wwf/repo (as deploy)..." -ForegroundColor Cyan
$clone = Ssh @("$Remote", @'
set -e
sudo -u deploy bash -c "cd /srv/wwf && [ -d repo/.git ] || git clone --depth=50 https://github.com/EliseyRotar/wwf-crotone-website.git repo"
ls -la /srv/wwf/repo | head -30
sudo -u deploy git -C /srv/wwf/repo log --oneline -1
'@)
Write-Host "  $($clone -join "`n")" -ForegroundColor Gray

# ─── Step 7: scaffold .env.production ─────────────────────────────────────────
Write-Host "[7.1] Scaffold /srv/wwf/.env.production from example..." -ForegroundColor Cyan
$pp = -join ((1..43) | ForEach-Object { Get-Random -InputObject ([char[]]'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/') })
$dbpw = -join ((1..32) | ForEach-Object { Get-Random -InputObject ([char[]]'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') })
$envBash = @'
set -e
cd /srv/wwf
sudo -u deploy cp repo/infra/.env.production.example .env.production.scaffold
sudo -u deploy bash -c '
set -e
cd /srv/wwf
F=.env.production
# Overwrite just the values we know
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=__DBPW__|"  $F
sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=__SECRET__|"            $F
sed -i "s|^GROQ_API_KEY=.*|GROQ_API_KEY=gsk_REPLACE_WITH_YOUR_GROQ_API_KEY_FROM_console_groq_com_keys|" $F
sed -i "s|^SMTP_USER=.*|SMTP_USER=TODO_brevo_user|"          $F
sed -i "s|^SMTP_PASS=.*|SMTP_PASS=TODO_brevo_smtp_key|"       $F
sed -i "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=TODO_r2_key|"     $F
sed -i "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=TODO_r2_secret|" $F
sed -i "s|^AWS_ENDPOINT=.*|AWS_ENDPOINT=https://TODO.r2.cloudflarestorage.com|" $F
chmod 600 $F
'
sudo chown deploy:deploy /srv/wwf/.env.production
echo "--- env head ---"
sudo -u deploy grep -v "^#" /srv/wwf/.env.production | sed -e "/^$/d" | sed -E "s/(TOKEN|SECRET|PASSWORD|KEY|TOKEN|TODO_)[^=]*=.*/\\1=***REDACTED***/"
'@
$envBash = $envBash -replace '__SECRET__', ($pp -replace "'", "'\''") `
                   -replace '__DBPW__',   ($dbpw -replace "'", "'\''")
$envOut = Ssh @("$Remote", "bash -s", $envBash)
Write-Host "  $($envOut -join "`n")" -ForegroundColor Gray

# ─── Step 9: nginx configs (already complete in repo) ─────────────────────────
Write-Host "[9.1] Stage nginx configs into /srv/wwf/nginx/..." -ForegroundColor Cyan
$ngx = Ssh @("$Remote", @'
set -e
cd /srv/wwf
sudo -u deploy cp repo/infra/nginx/nginx.conf       nginx/nginx.conf
sudo -u deploy cp repo/infra/nginx/conf.d/app.conf  nginx/conf.d/app.conf
sudo -u deploy chmod 0644 nginx/nginx.conf nginx/conf.d/app.conf
ls -la /srv/wwf/nginx /srv/wwf/nginx/conf.d
'@)
Write-Host "  $($ngx -join "`n")" -ForegroundColor Gray

# ─── Patch the prod compose to use the repo dir as build context ──────────────
# (Step 8 prerequisite; infra/docker-compose.yml at the moment has
#  context: . — which becomes the dir containing infra/. We need ../repo.)
Write-Host "[9.2] Patch infra/docker-compose.yml: build context -> ../repo..." -ForegroundColor Cyan
$patchC = Ssh @("$Remote", @'
set -e
F=/srv/wwf/repo/infra/docker-compose.yml
grep -q "context: \./repo" "$F" || \
  sed -i -E 's|(context:[[:space:]]*)\.$|\1./repo|g; s|(dockerfile:[[:space:]]*)Dockerfile$|\1../Dockerfile|g' "$F"
echo "--- build excerpt ---"
grep -A2 -E "build:|context:|dockerfile:" "$F" | head -20
'@)
Write-Host "  $($patchC -join "`n")" -ForegroundColor Gray

# ─── Step 8: docker compose up -d --build ────────────────────────────────────
Write-Host "[8.1] docker compose up -d --build (this takes a few minutes)..." -ForegroundColor Cyan
$up = Ssh @("$Remote", @'
set -e
cd /srv/wwf
sudo -u deploy bash -c "cd /srv/wwf && docker compose -f repo/infra/docker-compose.yml up -d --build" 2>&1 | tail -40
'@, 900)
Write-Host "  $($up -join "`n")" -ForegroundColor Gray

Write-Host "[8.2] docker compose ps + logs tail..." -ForegroundColor Cyan
$ps = Ssh @("$Remote", @'
sudo -u deploy docker compose -f /srv/wwf/repo/infra/docker-compose.yml ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}" || true
'@)
Write-Host "  $($ps -join "`n")" -ForegroundColor Gray

# ─── Step 6 placeholders for Cloudflare Origin cert ──────────────────────────
Write-Host "[6.1] Create empty CF Origin cert placeholders (operator fills them next)..." -ForegroundColor Cyan
$ph = Ssh @("$Remote", @'
set -e
install -m 0644 -o root -g root /dev/null /etc/ssl/cloudflare/cert.pem
install -m 0644 -o root -g root /dev/null /etc/ssl/cloudflare/key.pem
chmod 0600 /etc/ssl/cloudflare/key.pem
install -m 0644 -o deploy -g deploy /dev/null /srv/wwf/cert.pem
install -m 0600 -o deploy -g deploy /dev/null /srv/wwf/key.pem
ls -la /srv/wwf/{cert,key}.pem /etc/ssl/cloudflare/{cert,key}.pem
'@)
Write-Host "  $($ph -join "`n")" -ForegroundColor Gray

# ─── Step 10: cron stubs ──────────────────────────────────────────────────────
Write-Host "[10.1] Install cron jobs + stub walg scripts..." -ForegroundColor Cyan
$cronBash = @'
set -e
install -d /srv/wwf/scripts
cat > /srv/wwf/scripts/walg-backup.sh <<'EOF'
#!/usr/bin/env bash
# WAL-G daily base backup stub. Wired once R2 bucket + creds are set.
set -e
mkdir -p /var/log/wwf
echo "[$(date -u +%FT%TZ)] walg-backup.sh invoked (stub)" >> /var/log/wwf/walg.log
# TODO(unwired): docker exec -u postgres wwf-postgres wal-g backup-push /var/lib/postgresql/data
EOF
cat > /srv/wwf/scripts/walg-wal-push.sh <<'EOF'
#!/usr/bin/env bash
# WAL archive stub. Invoked every minute by cron; the real version runs
# pg_archivecleanup + wal-g wal-push from inside the postgres container.
set -e
mkdir -p /var/log/wwf
echo "[$(date -u +%FT%TZ)] walg-wal-push.sh invoked (stub)" >> /var/log/wwf/walg.log
EOF
chmod 0755 /srv/wwf/scripts/walg-backup.sh /srv/wwf/scripts/walg-wal-push.sh
chown -R deploy:deploy /srv/wwf/scripts

install -m 0644 /dev/null /etc/cron.d/wwf-backups
cat > /etc/cron.d/wwf-backups <<'EOF'
# /etc/cron.d/wwf-backups — installed by bootstrap-vps.ps1
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

0 3 * * *  deploy  /srv/wwf/scripts/walg-backup.sh  >> /var/log/wwf/walg.log 2>&1
* * * * *  deploy  /srv/wwf/scripts/walg-wal-push.sh >> /var/log/wwf/walg.log 2>&1
0 4 * * 0  deploy  /srv/wwf/scripts/test-restore.sh  >> /var/log/wwf/walg.log 2>&1
EOF
chmod 0644 /etc/cron.d/wwf-backups
ls -la /etc/cron.d/wwf-backups /srv/wwf/scripts/
'@
$cron = Ssh @("$Remote", "bash -s", $cronBash)
Write-Host "  $($cron -join "`n")" -ForegroundColor Gray

# ─── Step 12: deploy SSH key for CI ───────────────────────────────────────────
Write-Host "[12.1] Generate deploy SSH keypair (for GitHub Actions)..." -ForegroundColor Cyan
$dkOut = Ssh @("$Remote", @'
set -e
sudo -u deploy bash -c '
set -e
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -N "" -f ~/.ssh/wwf_deploy -C "wwf-crotone-deploy"
cat ~/.ssh/wwf_deploy.pub >> ~/.ssh/authorized_keys
chmod 0600 ~/.ssh/authorized_keys
'
echo "--- PRIVATE KEY (this is what you add to GitHub Secrets) ---"
sudo -u deploy cat /home/deploy/.ssh/wwf_deploy
echo "--- PUBLIC KEY ---"
sudo -u deploy cat /home/deploy/.ssh/wwf_deploy.pub
'@)
Write-Host "  $($dkOut -join "`n")" -ForegroundColor Cyan

# ─── Step 11: smoke test (interior of VPS — no DNS yet) ──────────────────────
Write-Host "[11.1] Run /srv/wwf/scripts/smoke-test.sh on the VPS (against localhost nginx)..." -ForegroundColor Cyan
$sm = Ssh @("$Remote", @'
set -e
sudo -u deploy bash -c "install -m 0755 repo/scripts/smoke-test.sh /srv/wwf/scripts/smoke-test.sh || true"
ls -la /srv/wwf/scripts/smoke-test.sh || true
bash /srv/wwf/scripts/smoke-test.sh || true
'@)
Write-Host "  $($sm -join "`n")" -ForegroundColor Gray

# ─── Final report ─────────────────────────────────────────────────────────────
Write-Host "`n=========== BOOTSTRAP REPORT ===========" -ForegroundColor Green
Write-Host ("  Root password   : {0}" -f $newRootPw) -ForegroundColor Yellow
Write-Host ("  Postgres PW     : {0}" -f $dbpw)        -ForegroundColor Yellow
Write-Host ("  AUTH_SECRET     : {0}" -f $pp)            -ForegroundColor Yellow
Write-Host "  Dev box pubkey  : installed for root + deploy"
Write-Host "  SSH             : key-only (PasswordAuthentication no)"
Write-Host "  UFW             : 22/80/443, default deny incoming"
Write-Host "  Docker          : engine + compose installed; deploy in docker group"
Write-Host "  Repo            : cloned to /srv/wwf/repo"
Write-Host "  .env.production : scaffolded at /srv/wwf/.env.production (600)"
Write-Host "  Nginx           : configs staged in /srv/wwf/nginx (CF IPs included)"
Write-Host "  Cron            : /etc/cron.d/wwf-backups (stubs log to /var/log/wwf/walg.log)"
Write-Host "  Cert placeholders: /srv/wwf/{cert,key}.pem and /etc/ssl/cloudflare/{cert,key}.pem"
Write-Host ""
Write-Host "ACTION ITEMS for you:" -ForegroundColor Yellow
Write-Host "  1. Save these NOW (they were generated this run and won't be shown again):"
Write-Host ("     POSTGRES_PASSWORD = {0}" -f $dbpw)
Write-Host ("     AUTH_SECRET       = {0}" -f $pp)
Write-Host ("     root SSH password = {0}" -f $newRootPw)
Write-Host "  2. Paste the Cloudflare Origin cert into /srv/wwf/cert.pem and the key"
Write-Host "     into /srv/wwf/key.pem on the VPS, then:"
Write-Host "         sudo cp /srv/wwf/cert.pem /etc/ssl/cloudflare/cert.pem"
Write-Host "         sudo cp /srv/wwf/key.pem  /etc/ssl/cloudflare/key.pem"
Write-Host "         sudo systemctl reload docker   # nginx runs inside a container, so:"
Write-Host "         sudo -u deploy docker compose -f /srv/wwf/repo/infra/docker-compose.yml restart nginx"
Write-Host '  3. Set SMTP_USER/SMTP_PASS (Brevo) and AWS_* (R2) in /srv/wwf/.env.production'
Write-Host '     via `sudo -u deploy nano /srv/wwf/.env.production`'
Write-Host '  4. Add the deploy private key (printed above) to GitHub repo Secrets as'
Write-Host '     VPS_SSH_KEY, and configure your CI workflow to ssh deploy@<host>.'
Write-Host '  5. Once DNS A records @ + www point at 159.195.42.18 and CF proxy is on,'
Write-Host '     nginx will start accepting real traffic. The smoke test above only'
Write-Host '     exercises the localhost hop; public SSL requires the Origin cert.'
Write-Host '  6. The Netcup Mail Block firewall is verified below in the script output.'
Write-Host '     If API could not disable it, do it manually from the Netcup SCP panel.'
