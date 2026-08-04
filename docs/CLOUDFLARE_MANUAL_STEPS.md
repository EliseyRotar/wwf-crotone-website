# Cloudflare manual setup — UI steps for things the API token can't reach
# Run this AFTER the API script completes (DNS records) but BEFORE you deploy.
#
# These 6 clicks take ~3 min total. The token I gave you only has DNS scope.

# ============================================================
# STEP 1: Enable Email Routing
# ============================================================
# 1. Go to https://dash.cloudflare.com/?zone=20e5a251cced0a2667fdbadaa6b034fa (or click your zone)
# 2. Left sidebar → Email → Email Routing
# 3. Click "Get started" (the orange/blue button)
# 4. Cloudflare auto-adds the MX records (already done by the API script ✓)
# 5. Confirm the wizard completes — you should see "Active" status

# ============================================================
# STEP 2: Add Email Routing rules (after enabling)
# ============================================================
# Still in Email Routing panel:
# 1. Click "Create address" / "Add rule" (top right button)
# 2. Custom address:
#    - Address: info
#    - Action: Forward to → wwfcrotone26@gmail.com
#    - Click Save
# 3. Catch-all:
#    - Click "Catch-all address" toggle
#    - Action: Forward to → wwfcrotone26@gmail.com
#    - Click Save
# 4. Confirm via the email Cloudflare sends to wwfcrotone26@gmail.com
#    (click the verification link in the email)

# ============================================================
# STEP 3: Enable SSL Full-Strict
# ============================================================
# 1. Left sidebar → SSL/TLS → Overview
# 2. Encryption mode: click "Full (strict)" → confirm
#    (the API token doesn't have permission for this — needs UI)

# ============================================================
# STEP 4: Enable Always Use HTTPS + Min TLS 1.2
# ============================================================
# 1. Same SSL/TLS panel, "Edge Certificates" tab:
#    - Always Use HTTPS: toggle ON
#    - Minimum TLS Version: select TLS 1.2 (default is fine)
#    - HTTP/2: ON
#    - HTTP/3 (QUIC): ON
#    - Automatic HTTPS Rewrites: ON
# 2. Save (some auto-save)

# ============================================================
# STEP 5: Enable Bot Fight Mode + Block AI Bots
# ============================================================
# 1. Left sidebar → Security → Bots
# 2. Bot Fight Mode: toggle ON
# 3. Confirm
# 4. (Optional but recommended) Go to Security → Bots → AI Bots
#    - Block AI training bots: ON
#    This blocks GPTBot, ClaudeBot, Common Crawl etc. from scraping wwfcrotone.it

# ============================================================
# STEP 6: Generate Origin SSL Certificate
# ============================================================
# 1. Left sidebar → SSL/TLS → Origin Server
# 2. Click "Create certificate"
# 3. Keep defaults:
#    - Hosts: *.wwfcrotone.it, wwfcrotone.it (auto-selected)
#    - Validity: 15 years
# 4. Click Next
# 5. Save BOTH blocks:
#    - Certificate (save as cloudflare-origin-cert.pem)
#    - Private key (save as cloudflare-origin-key.pem)
# 6. Upload these to your VPS later via SSH:
#    scp cloudflare-origin-cert.pem deploy@<VPS_IP>:/etc/ssl/cloudflare/cert.pem
#    scp cloudflare-origin-key.pem deploy@<VPS_IP>:/etc/ssl/cloudflare/key.pem

# ============================================================
# STEP 7: (After VPS is up) Create R2 bucket
# ============================================================
# 1. Left sidebar → R2 Object Storage → Create bucket
# 2. Name: wwf-backups
# 3. Location: Europe (jurisdiction: EU)
# 4. Storage class: Standard
# 5. Click Create
# 6. Click "Manage R2 API Tokens" → "Create API token"
# 7. Name: walg-backups
# 8. Permissions: Object Read & Write
# 9. Bucket: wwf-backups (specific)
# 10. Click "Create API token"
# 11. SAVE (only shown once):
#     - Access Key ID
#     - Secret Access Key
#     - Endpoint: https://<accountid>.r2.cloudflarestorage.com

# ============================================================
# AFTER: add A records (once VPS IP is known)
# ============================================================
# Use the API token you have (DNS Edit scope) — this script will run via API:
#
#   cd C:\Users\Admin\Documents\WWF_CROTONE_WEBSITE
#   $vpsIp = "PASTE_NETCUP_IP_HERE"
#   .\infra\scripts\cloudflare-add-a-records.ps1 -VpsIp $vpsIp
#
# This adds A records for @ and www pointing at the Netcup VPS

echo "Document complete — read top to bottom, follow steps 1-7 in order"