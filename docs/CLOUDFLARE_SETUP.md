# Cloudflare Zone Bootstrap — wwfcrotone.it

**Purpose:** take the freshly-registered domain from Aruba and wire it through Cloudflare so DNS, CDN, WAF, SSL, Email Routing, R2, and DDoS protection all work end-to-end.

## Prerequisites

- `wwfcrotone.it` registered with Aruba (order `[redacted]`, paid €4.87) — wait for the activation email before continuing
- Cloudflare account at https://dash.cloudflare.com (free tier is enough)
- Contabo VPS public IP — save it before starting (`<CONTABO_IP>` placeholder below)
- A debit card on file with Cloudflare (free tier doesn't charge, but they require one for account verification)

---

## Step 1 — Add the site to Cloudflare

1. https://dash.cloudflare.com → top bar → **"+ Add a site"**
2. Type `wwfcrotone.it` → click **Add site**
3. Plan: select **Free** → **Continue**
4. Cloudflare will scan existing DNS records (just the SOA/NS from Aruba). Accept whatever it suggests.

## Step 2 — Copy the two Cloudflare nameservers

After adding the site, Cloudflare shows **two nameservers** (something like `chip.ns.cloudflare.com`, `dara.ns.cloudflare.com`). **Write them down** — you need them in the next step.

> Do **NOT** skip this step. If you close the tab, you have to dig them out of `whois wwfcrotone.it` later.

## Step 3 — Point Aruba nameservers at Cloudflare

1. Log into Aruba → https://admin.aruba.it
2. **Domini → wwfcrotone.it → Gestione DNS / Nameserver**
3. Choose **"Usa nameserver personalizzati / custom nameservers"**
4. Paste the two Cloudflare nameservers
5. **Save**

**Wait 5-30 minutes** for NS propagation. Cloudflare will email you once it detects the cutover. You can also check status on the Cloudflare dashboard — when the site shows "Active", you're good.

## Step 4 — Add the DNS records

In **Cloudflare dashboard → DNS → Records**, add:

### Apex + WWW
| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| A | `@` | `<CONTABO_IP>` | Proxied | Auto |
| A | `www` | `<CONTABO_IP>` | Proxied | Auto |

### Subdomains (CNAMEs to apex)
| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `admin` | `wwfcrotone.it` | Proxied |
| CNAME | `status` | `wwfcrotone.instatus.com` | Proxied *(add after claiming Instatus)* |

### Mail (Cloudflare Email Routing inbound)
| Type | Name | Priority | Target |
|---|---|---|---|
| MX | `@` | 18 | `route1.mx.cloudflare.net` |
| MX | `@` | 92 | `route2.mx.cloudflare.net` |
| MX | `@` | 92 | `route3.mx.cloudflare.net` |

### Email authentication
| Type | Name | Content |
|---|---|---|
| TXT | `@` | `v=spf1 include:spf.brevo.com ~all` |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:[redacted]` |
| TXT | `brevo-site-verification=...` | *(paste from Brevo dashboard, see Phase 5 below)* |

### Cloudflare auto-verification (auto-added when you first add the zone)
| Type | Name | Content |
|---|---|---|
| TXT | `cf2024-1.wwfcrotone.it` | *(Cloudflare-pasted, auto)* |

## Step 5 — Configure Email Routing

**Cloudflare dashboard → Email → Email Routing → Overview** (or directly):

1. Click **"Get started"** if first time
2. Cloudflare auto-adds the MX records (already done in Step 4) ✓
3. Cloudflare auto-adds the SPF record (replaces ours if needed — merge with Brevo's)
4. **Routing rules**:
   - Custom address: `info@wwfcrotone.it` → destination `[redacted]` → action **Forward**
   - Catch-all: `*@wwfcrotone.it` → `[redacted]` → action **Forward**
5. Verify the destination address (Cloudflare emails `[redacted]` with a confirmation link)

**Result:** Any email sent to `info@wwfcrotone.it` (or anything-else@wwfcrotone.it) lands in `[redacted]`.

## Step 6 — Generate the Cloudflare Origin certificate

**Cloudflare dashboard → SSL/TLS → Origin Server → Create Certificate**:

1. Click **Create certificate**
2. Keep defaults (15-year validity, RSA 2048, includes `wwfcrotone.it` + `*.wwfcrotone.it`)
3. Copy the **Certificate** block → save as `cert.pem`
4. Copy the **Private key** block → save as `key.pem`
5. **Important**: store these securely. You'll upload them to the Contabo VPS at `/etc/ssl/cloudflare/`.

> These two files allow the connection between Cloudflare's edge and your VPS to also be TLS-encrypted (end-to-end). Even if someone is on the same network as your VPS, they can't intercept traffic.

## Step 7 — Set SSL/TLS mode

**Cloudflare dashboard → SSL/TLS → Overview**:
- Encryption mode: **Full (strict)** ← required for the Origin cert to be validated
- Always Use HTTPS: **ON**
- HTTP/2: **ON**
- HTTP/3 (QUIC): **ON**
- Min TLS version: **TLS 1.2**
- Automatic HTTPS Rewrites: **ON**

## Step 8 — Enable Bot Fight Mode

**Cloudflare dashboard → Security → Bots → Bot Fight Mode**: toggle **ON**.

This blocks obvious bots (no CAPTCHA, no user friction). Legitimate users pass through.

## Step 9 — Enable Rate Limiting rules

**Cloudflare dashboard → Security → WAF → Rate limiting rules → Create rule**:

| Rule | Match | Action |
|---|---|---|
| **API protection** | All incoming requests matching `/api/*` | 30 requests / minute / IP → challenge |
| **Login protection** | `/admin/login` OR `/api/account/magic-link` | 5 requests / 10 minutes / IP → block |
| **Chatbot protection** | `/api/chat` | 10 requests / hour / IP → challenge |

(Free tier includes 1 rate-limit rule. The app also has its own rate limits via Upstash Redis. This is defense-in-depth.)

## Step 10 — Set up Cloudflare R2

**Cloudflare dashboard → R2 Object Storage → Create bucket**:
1. Name: `wwf-backups`
2. Region: **EU** (jurisdiction: European Union)
3. Storage class: Standard
4. Create bucket

**Create API token for WAL-G**:
1. R2 → Manage R2 API Tokens → Create API token
2. Name: `wal-g-backups`
3. Permissions: **Object Read & Write**
4. Scope: bucket = `wwf-backups`
5. TTL: leave blank
6. **Save the credentials shown** (only shown once):
   - Access Key ID → save as `R2_ACCESS_KEY_ID`
   - Secret Access Key → save as `R2_SECRET_ACCESS_KEY`
   - Endpoint → `https://<accountid>.r2.cloudflarestorage.com` → save as `R2_ENDPOINT`

These three values go into `/srv/wwf/.env.production` (set by Bootstrap script).

---

## Step 11 — Claim your Instatus subdomain

This is the only step that requires an external signup:

1. https://instatus.com → sign up (free)
2. Create status page, claim subdomain **`wwfcrotone`** → URL becomes `https://wwfcrotone.instatus.com`
3. Add components: Site, API, Database, Email, Chatbot
4. **Status page → Settings → Domains → Add custom domain**: `status.wwfcrotone.it`
5. Instatus shows you a CNAME target. Go back to **Cloudflare DNS** and add:
   - CNAME `status` → `<instatus-cname-target>` (Proxied)

## Step 12 — Verify everything

Run these from your laptop:

```bash
# NS propagation
dig NS wwfcrotone.it +short
# Should return your two Cloudflare nameservers

# DNS records
dig A wwfcrotone.it +short
# Should return the Contabo VPS IP

dig MX wwfcrotone.it +short
# Should return route1/2/3.mx.cloudflare.net

# Email routing
echo "Test from $(date)" | mail -s "Cloudflare test" info@wwfcrotone.it
# Check [redacted] inbox (Cloudflare forwards)

# HTTPS
curl -I https://wwfcrotone.it
# Should return 200 (after Contabo VPS is up)

# CSP nonce
curl -sI https://wwfcrotone.it | grep -i content-security-policy
# Should show nonce-... in script-src
```

---

## Post-bootstrap checklist

- [ ] NS delegation confirmed (Cloudflare email + `dig NS`)
- [ ] A records point at Contabo VPS
- [ ] MX records in place (route1/2/3.mx.cloudflare.net)
- [ ] Cloudflare Email Routing → catch-all to `[redacted]` works (send test email)
- [ ] Origin cert generated and uploaded to VPS
- [ ] SSL/TLS mode = Full (strict)
- [ ] WAF + Bot Fight Mode enabled
- [ ] R2 bucket `wwf-backups` created with EU region + API token saved
- [ ] Instatus claimed as `wwfcrotone` subdomain
- [ ] status.wwfcrotone.it CNAME pointing at Instatus

Once all green → move to Phase 6 (Brevo SMTP for transactional) and Phase 7 (GitHub Actions secrets).