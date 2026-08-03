# Brevo SMTP — Transactional Email for wwfcrotone.it

**Purpose:** send booking confirmations, magic links, and admin notifications from `noreply@wwfcrotone.it` (or `info@wwfcrotone.it`) using Brevo's free SMTP relay.

## Why Brevo (not Gmail)

| Provider | Daily limit | Free? | Sender domain | Notes |
|---|---|---|---|---|
| **Brevo** | 300/day | ✓ | Custom (wwfcrotone.it) | SMTP + tracking, no card |
| Resend | 100/day, 3k/mo | ✓ | Custom | Modern API, 1 domain only |
| Gmail SMTP | 500/day | ✓ | gmail.com only | Limited, fragile |
| Amazon SES | 3k/mo from EC2 | ✓ (then $0.10/1k) | Custom | AWS setup overhead |

We picked **Brevo** because:
- 300 emails/day is more than enough for ~240 volunteers × 3 transactional emails each = ~720/month
- Standard SMTP (works with our existing `nodemailer` setup, no code changes beyond env vars)
- DKIM/SPF/DMARC pre-configured by Brevo (no manual DNS for that part)
- No credit card to sign up

## Prerequisites

- Brevo account at https://www.brevo.com (sign up with `wwfcrotone26@gmail.com`)
- Domain `wwfcrotone.it` already delegated to Cloudflare (so you can add DNS records)
- VPS deployed (the .env.production file is where you put Brevo credentials)

---

## Step 1 — Verify the domain in Brevo

1. Brevo dashboard → **Settings → Senders & Domains → Domains → Add a domain**
2. Type: `wwfcrotone.it`
3. Brevo generates a verification TXT record. It looks like:
   ```
   Type: TXT
   Name: mail._domainkey.wwfcrotone.it
   Value: k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...
   ```
4. Go to **Cloudflare dashboard → DNS → Records → Add**:
   - Type: TXT
   - Name: `mail._domainkey`
   - Value: paste the full Brevo value (it's long, ~300 chars)
   - TTL: Auto
5. Back in Brevo, click **Verify**. It checks the TXT record via DNS. Should pass within 1-5 minutes.
6. **Save** the DKIM selector name (usually `mail`) — you'll need it for SPF.

## Step 2 — Add the SPF record (already in the Cloudflare setup doc)

You should already have:
- TXT `@` → `v=spf1 include:spf.brevo.com ~all`

If you don't, add it now in Cloudflare DNS. The `~all` is "soft fail" which is safe; change to `-all` if you want strict rejection (more aggressive, do this only after confirming Brevo is your only outbound email provider).

## Step 3 — Create an SMTP key in Brevo

1. Brevo dashboard → **Settings → SMTP & API → SMTP → Create a new SMTP key**
2. Name: `wwf-crotone-smtp`
3. Permissions: **Full access** (you can scope it later if needed)
4. **Save the SMTP key shown** (only shown once):
   - SMTP login: `your-brevo-email@example.com` (often the same as your account email)
   - SMTP key: `xsmtpsib-xxx...` (long alphanumeric)
5. Note the SMTP host: `smtp-relay.brevo.com`
6. Note the port: `587` (STARTTLS) — **do not use 465** for Brevo

## Step 4 — Create a sender email address

1. Brevo dashboard → **Settings → Senders & Domains → Senders → Add a sender**
2. Email: `noreply@wwfcrotone.it` (or `info@wwfcrotone.it`)
3. Name: `WWF Crotone Volunteer Camps`
4. Click the verification link Brevo emails to `wwfcrotone26@gmail.com`

## Step 5 — Configure the app

Add to `/srv/wwf/.env.production`:

```env
# ─── Transactional email (Brevo free tier) ─────────────────────
USE_BREVO_EMAIL=true
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-email@example.com
SMTP_PASS=xsmtpsib-xxx...
ADMIN_NOTIFY_EMAIL=wwfcrotone26@gmail.com
```

Then `docker compose restart app` to pick up the new env.

## Step 6 — Test

From the VPS:

```bash
docker exec -it wwf-app-1 node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.sendMail({
  from: 'WWF Crotone <noreply@wwfcrotone.it>',
  to: 'wwfcrotone26@gmail.com',
  subject: 'Brevo test',
  text: 'It works.'
}).then(r => console.log('OK:', r.messageId)).catch(e => console.error('FAIL:', e));
"
```

Check `wwfcrotone26@gmail.com` — you should receive the test email within seconds. If it goes to spam, check the SPF record is `v=spf1 include:spf.brevo.com ~all` and DKIM is verified.

## Step 7 — Switch from Gmail fallback (if you ever hit Brevo's 300/day cap)

In `/srv/wwf/.env.production`, change:

```env
USE_BREVO_EMAIL=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=wwfcrotone26@gmail.com
SMTP_PASS=...       # Gmail app password (not account password)
```

The application code (`src/lib/mail.ts`) reads `USE_BREVO_EMAIL` and routes accordingly. No rebuild needed — just `docker compose restart app`.

---

## What gets sent via Brevo

| Email | Trigger | Sender | Locale |
|---|---|---|---|
| Booking confirmation | `POST /api/iscrizione` | `noreply@wwfcrotone.it` | It/En (matches user) |
| Magic link | `POST /api/account/magic-link` | `noreply@wwfcrotone.it` | It/En |
| Booking edit notification | Volunteer edits a booking | `noreply@wwfcrotone.it` | It/En |
| Receipt upload notification | Volunteer uploads a receipt | `noreply@wwfcrotone.it` | It/En |
| Bulk email | Admin sends bulk | `noreply@wwfcrotone.it` | It/En |

All sent through the same Brevo SMTP. Total expected volume: 720 emails per camp season (240 volunteers × 3 emails each). Well under the 300/day limit.

## Monitoring

- Brevo dashboard → **Statistics** shows delivery rate, open rate, bounce rate
- Sentry captures any `mail.ts` errors
- UptimeRobot alerts if `/api/health` fails (one symptom could be Brevo outage affecting magic-link sends)

## Fallback chain

```
1. Brevo (default, USE_BREVO_EMAIL=true)
   ↓ if Brevo fails (5xx, 429, timeout)
2. Gmail SMTP (USE_BREVO_EMAIL=false, swap env, restart)
   ↓ if Gmail fails
3. Manual: read notification in Sentry + email Paolo
```

No automatic failover — but rate-limited retries on the send side cover transient failures.