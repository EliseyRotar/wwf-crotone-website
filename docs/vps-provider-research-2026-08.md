# VPS Provider Research — WWF Crotone (wwfcrotone.it)

**Date**: August 2026 | **For**: Solo dev (Elisey) running a Next.js 15 + Postgres 16 + Redis 7 + Nginx stack on Docker Compose
**Requirements**: 2+ vCPU, 4+ GB RAM, 40+ GB SSD, EU data residency, GDPR, €50–80/yr, single dev ops time, Docker Compose friendly

> **Critical market shift**: Between May and June 2026, both Hetzner (+33–173%) and OVH (+55%) raised VPS prices significantly. Pricing in older comparisons is **stale**. Numbers below are current as of August 2026.

---

## Provider-by-provider analysis

### 1. Hetzner Cloud (Falkenstein / Nuremberg, DE)

**Pricing** (post-15 June 2026 — verified from Hetzner docs):
- **CX23** (shared, x86): 2 vCPU, 4 GB RAM, 40 GB SSD NVMe — **€5.49/mo** (excl. VAT, hourly billing available)
- **CX33** (shared): 2 vCPU, 8 GB / 80 GB — €8.49/mo
- **CPX22** (dedicated vCPU): 2 vCPU, 4 GB / 40 GB — **€19.49/mo** (excl. VAT)
- **CAX11** (ARM, shared): 2 vCPU, 4 GB / 40 GB — €5.99/mo
- IPv4 add-on: **+€0.50/mo** (€6/yr)
- Bandwidth: 20 TB/mo included; €1.19/TB overage
- **Year 1 cost: ~€72/yr** (incl. 19% VAT, with IPv4)

**Onboarding** (★★★☆☆ — penalised by recent KYC shift):
- Console signup is quick, SSH key auto-accepted, server provisions in **<60 seconds**
- **BUT**: Hetzner began requesting **passport/government ID verification** for many accounts since May 2026 (one Reddit user reported being asked for a passport, switched providers) — this is non-deterministic; some users still pass without. For an Italian ODV/ETS this could be a roadblock
- Pre-payment required: minimum credit top-up (€5–25) via PayPal/card/SEPA
- No 24/7 phone support; email + community forum; 24/7 status email since 2025

**Docker ergonomics** (★★★★★):
- One-click Docker CE app in cloud console marketplace
- NVMe SSD, 1 Gbit/s shared NIC, no overselling claims — Hetzner has historically been very Docker-friendly
- Private networks included free; volume storage available

**GDPR + DPA** (★★★★★):
- **ISO 27001** certified, **BSI C5** testate (Hetzner FSN/NBG/HEL)
- DPA available on request, in line with Art. 28 GDPR
- **Made in Germany**, fully GDPR-compliant, no US CLOUD Act exposure
- Two data center parks: Falkenstein (FSN1) and Nuremberg (NBG1), plus Helsinki

**Reliability** (★★★☆☆ — recent stability concerns):
- **99.9% SLA** with credits (cloud); 99.9% on dedicated
- Anti-DDoS included (free, network-level)
- **Recent issues**: community has reported "10 outages in 30 days" (r/hetzner, June 2026) — many complaints about FSN1 being oversold; users are warning about reliability degradation
- Status: https://status.hetzner.com
- Snapshots €0.01/GB/mo, backups 20% of instance price

**Real user sentiment** (★★★☆☆):
- Hetzner was the *de facto* go-to for EU devs. Recent price hikes have **shattered trust** — r/hetzner "Hetzner, these prices are ludicrous" (432 upvotes) and "Thank you Hetzner" sarcastic post (one user saved money by leaving)
- Still widely used; quality remains good where stock is available. But: **FSN1 frequently sold out**, forced resizes common

**Verdict**: Best price/performance historically; now no longer the bargain it was, and reliability complaints are real. C5 + ISO 27001 + German jurisdiction is the gold standard for GDPR. **KYC risk** is the new unknown.

---

### 2. Contabo (Nuremberg, DE + EU locations)

**Pricing**:
- **Cloud VPS 4** (4 vCPU, 8 GB RAM, 100 GB SSD): **€5.50/mo** = **€66/yr** (24-month commit)
- **Cloud VPS 6** (6 vCPU, 12 GB, 200 GB): €7.50/mo = €90/yr
- IPv4 + IPv6 **included**
- **"Unlimited" traffic** (fair-use; subject to throttling for abusive workloads)
- 200–800 Mbit/s port depending on tier
- No setup fee; first-year discount for 24-mo term, then full price

**Onboarding** (★★★★☆):
- Account creation is fast; **first payment must be manual** (SEPA bank transfer, PayPal, credit card, crypto). Card auto-pay available *after* first order
- No ID verification for standard EU VPS (only for dedicated)
- Provisioning "in minutes" (often 5–15 min; occasionally longer when stock is constrained)

**Docker ergonomics** (★★★☆☆):
- 1-click Docker image available; Docker Compose works fine
- SSD (not NVMe on Core tier; Performance VPS adds NVMe)
- Network between containers: standard Linux bridge, no special tuning

**GDPR + DPA** (★★★★☆):
- ISO 27001 certified (Nuremberg DC)
- DPA available; Contabo GmbH, German company
- Data residency: DE/EU only; "no data to non-EU countries" claim

**Reliability** (★★★☆☆):
- 99.9% uptime advertised
- **Free DDoS protection** on all plans
- Snapshots included (1–3 depending on tier), auto-backup add-on available
- Frequent community complaints about **network performance** and "noisy neighbour" syndrome

**Real user sentiment** (★★☆☆☆):
- **Very polarising**. "Avoid Contabo at all costs" is a recurring r/selfhosted refrain — primarily complaints about network speed, I/O contention, aggressive upselling
- Trustpilot: ~3.5–4 stars overall; many reviews cite slow support and inconsistent performance
- However, for low-traffic workloads (the WWF site fits), users report it "just works"

**Verdict**: Cheapest for the spec. But reputation risk: if you need reliable support or predictable performance under load, look elsewhere. For a quiet NGO site, it would be fine — but the support / performance risk is the price you pay for €5.50/mo.

---

### 3. Netcup (Nuremberg, DE + Vienna, AT + Amsterdam, NL)

**Pricing**:
- **VPS 500 G12**: 2 vCore x86, 4 GB DDR5 ECC, **128 GB NVMe** — **€5.91/mo** (incl. 19% VAT) = **~€70.92/yr**
- VPS 1000 G12: 4 vCore / 8 GB / 256 GB — €10.37/mo = ~€124.44/yr (over budget)
- VPS 2000 G12: 8 vCore / 16 GB / 512 GB — €19.25/mo
- IPv4 included; traffic unmetered (fair use)
- **Promo**: €5 welcome voucher via newsletter; 12-month commit gives biggest discount; hourly billing available with no minimum term

**Onboarding** (★★☆☆☆ — KYC is real friction):
- 1-page signup, but **netcup enforces KYC** (Ausweis/ID upload + proof of address) before/during order — this is a known friction point for solo devs
- After verification, server is provisioned in **minutes**
- 99.9% annual availability SLA

**Docker ergonomics** (★★★★★):
- VPS G12 uses NVMe + DDR5 ECC RAM
- Pre-built Docker image in customer panel
- SCP (Server Control Panel) supports cloud-init, snapshots, remote console
- Hourly billing makes it easy to spin up/down

**GDPR + DPA** (★★★★★):
- **ISO 27001** + **ISO 27701** (privacy extension) + **ISO 27018** (PII protection) + ISO 9001 + ISO 14001
- ISO 27001 cert is annually audited
- DPA available on request
- Green electricity, German company (netcup GmbH), subsidiary of Anexia
- Multiple EU locations: Vienna (VIE), Nuremberg (NUE), Amsterdam (AMS)

**Reliability** (★★★★☆):
- Anti-DDoS included free on all plans
- No public SLA but historical track record is solid
- Local Block Storage add-on (up to 8 TB) for scaling

**Real user sentiment** (★★★★☆):
- Strong reputation in EU selfhosted community; "Web Host of the Year 2025" award
- Common complaint: **KYC friction** at signup, support can be slow for tickets
- Considered the **dark-horse alternative to Hetzner** for the cost-conscious EU crowd

**Verdict**: Excellent choice for GDPR-sensitive workloads; the spec at €5.91/mo is competitive. KYC is annoying but the cert portfolio (27001 + 27701 + 27018) is best-in-class for an Italian NGO handling minors' data.

---

### 4. Scaleway (Paris, FR + Warsaw, PL + Amsterdam, NL + **Milan, IT**)

**Pricing** (Development / General Purpose):
- **DEV1-S** (1 vCPU shared, 2 GB, 20 GB SSD): €2.99/mo
- **PRO2-S** (2 vCPU shared, 4 GB, 40 GB SSD): ~€3.99/mo (verify current price)
- **PRO2-M** (4 vCPU shared, 8 GB, 80 GB SSD): ~€7.99/mo
- **GP1-S** (dedicated AMD EPYC, 2 vCPU / 4 GB / 40 GB): ~€9.99/mo
- IPv4 + IPv6 included; bandwidth from 100 Mbps to 10 Gbps
- **Year 1 cost**: PRO2-S ~€48/yr (within budget!) — but **verify** at signup

**Onboarding** (★★★★★):
- Quick signup, no KYC for standard usage; identity verification only when adding payment method or for billing thresholds
- Console is clean, modern; CLI and Terraform support
- Provisioning in **seconds** via API
- Card / SEPA / PayPal accepted

**Docker ergonomics** (★★★★★):
- All major Linux distros pre-installed
- Docker works perfectly; private networks (VPC) free
- Recent hardware (AMD EPYC Turin/Zen 5 in new GP3 instances)

**GDPR + DPA** (★★★★★):
- French company (Scaleway SAS, Iliad group)
- **HDS-certified** (healthcare data hosting) — directly relevant for an NGO with health-related camp signups
- ISO 27001, ISO 27017, ISO 27018, ISO 27019, SecNumCloud-ready
- DPA available
- **MIL1 (Milan) DC available** — lowest latency for Italian users; **Paris** for data sovereignty

**Reliability** (★★★★☆):
- SLA: 99% to 99.5% depending on tier
- Anti-DDoS included; Edge Services / WAF available
- Multiple AZs in Paris, Amsterdam, Warsaw; Milan = 1 AZ (newer)
- Status: https://status.scaleway.com
- Public trust: **Airbus moved 70 critical apps from AWS to Scaleway** (July 2026) for digital sovereignty — significant enterprise validation

**Real user sentiment** (★★★★☆):
- Strong on r/europe, r/BuyFromEU as a sovereign EU cloud option
- Some criticism of complex pricing model and occasional support delays
- Generally praised for GDPR/sovereignty story

**Verdict**: The **strongest sovereignty story** in this comparison. Milan DC is unique among these candidates — Italian visitors get ~5–15 ms latency, and the data is in Italy/EU. HDS cert is a major plus if you ever handle health data. Could be the right pick **if** PRO2-S meets budget (verify the exact August 2026 price).

---

### 5. OVHcloud (Roubaix / Strasbourg / Gravelines, FR + Limburg, DE)

**Pricing** (post-April 2026, 55% increase on some tiers):
- **VPS-1**: 2 vCPU, 4 GB RAM, 40 GB NVMe, 500 Mbps, "unlimited" traffic — ~**€6.50/mo** = ~€78/yr (verify; OVH restructured lineup)
- VPS-2: 4 vCPU, 8 GB, 80 GB NVMe, 1 Gbps — ~€10/mo
- VPS-3: 6 vCPU, 12 GB, 100 GB NVMe, 2 Gbps — ~€16/mo
- VPS-4: 8 vCPU, 24 GB, 200 GB NVMe, 3 Gbps — ~€28/mo
- IPv4 included

**Onboarding** (★★★☆☆):
- French-language-default control panel; English available
- Account creation + payment; KYC required for new accounts (passport / ID) — added 2023–2024
- Provisioning: typically **5–15 min**

**Docker ergonomics** (★★★★☆):
- Debian/Ubuntu images work cleanly; 1-click Docker on some images
- OVHcloud API + CLI + Terraform
- Anti-DDoS included; vRack private network free

**GDPR + DPA** (★★★★★):
- OVH SAS, French company
- ISO 27001, ISO 27017, ISO 27018, ISO 27701, **SecNumCloud** (highest French government cert for some products)
- DPA downloadable
- 33+ data centers globally; multiple EU locations
- Anti-US CLOUD Act positioning is a major marketing point

**Reliability** (★★★☆☆):
- 99.9% SLA on most products
- Anti-DDoS / Game DDoS included
- Historical 2021 Strasbourg fire was a major outage; rebuilt since then
- Recent community sentiment: **55% price hikes** announced for April 2026, "OVH raises prices. My new offer is 55.1% higher" (r/sysadmin, 323 upvotes) — users were not happy
- Status: https://status.ovhcloud.com

**Real user sentiment** (★★★☆☆):
- Historically "good enough" for price; current sentiment is negative due to price hikes and inconsistent support
- Praised for EU sovereignty and feature breadth
- Criticised for support delays and aggressive price increases

**Verdict**: A solid choice if you need French/EU sovereignty; but **price hikes have eroded the value proposition** and trust is damaged. Better for enterprise than solo dev. The 2 vCPU/4GB/40GB VPS-1 at ~€78/yr is the closest fit to our budget.

---

### 6. IONOS (Karlsruhe, DE + Strasbourg, FR + others)

**Pricing** (with **24-month** term to lock in intro rate):
- **VPS S+**: 2 vCPU, 2 GB, 90 GB NVMe — **$2/mo** for 3 months, then **$5/mo** = $60/yr
- **VPS M+**: 4 vCPU, 4 GB, 120 GB NVMe — $4/mo promo → $11/mo = $132/yr
- **VPS L+**: 6 vCPU, 8 GB, 240 GB NVMe — $6/mo promo → $21/mo = $252/yr
- **No native 2 vCPU / 4 GB / 40 GB tier**; closest is VPS S+ (only 2 GB) or VPS M+ (4 vCPU / 4 GB but $132/yr — over budget)
- IPv4 + IPv6 included
- Bandwidth: "unlimited" 1 Gbps
- **Year 1 cost**: VPS S+ ≈ **€55/yr** (USD accepted; price cliff at renewal)

**Onboarding** (★★★☆☆):
- Signup is fast; aggressive upsells during checkout
- Phone-verification often required ("personal consultant" approach)
- Some reports of **inconsistent billing** and unexpected renewals
- Server provisioning fast (~minutes)

**Docker ergonomics** (★★★☆☆):
- Linux images work, but Plesk and cPanel are pushed
- NVMe SSD; KVM console in cloud panel
- Data Center Designer (DCD) for infrastructure-as-code

**GDPR + DPA** (★★★★☆):
- IONOS SE (Germany), part of United Internet group
- ISO 27001 certified, ISO 27017, ISO 27018, ISO 27019
- TÜV-certified; GDPR-compliant
- DPA available

**Reliability** (★★★☆☆):
- 99.99% uptime claim
- Anti-DDoS included
- Multiple EU/US data centers
- Cloud Panel for management

**Real user sentiment** (★★☆☆☆):
- **Very polarising**: r/de_EDV thread "Warum wird IONOS so gehasst?" (48 upvotes, 111 comments) — many users report bad billing experiences, aggressive renewal price hikes
- Trustpilot: ~4.0 stars; complaints focus on auto-renewal price increases and support difficulty
- Useful for simple, low-touch workloads

**Verdict**: **Avoid for our use case** — no exact spec match (need 4 GB RAM, VPS S+ only has 2 GB), and the renewal pricing cliff is exactly the kind of trap the user wants to avoid. The user explicitly asked for 4+ GB RAM.

---

### 7. BuyVM (Luxembourg, LU + Las Vegas, NY)

**Pricing** (no promo tricks, all-in pricing in USD):
- **Slice 512**: 1 core / 512 MB / 10 GB SSD / unmetered — $24/yr (1 vCPU, 512 MB — under spec)
- **Slice 1024**: 1 core / 1 GB / 20 GB SSD / unmetered — **$42/yr** (under spec on RAM)
- **Slice 2048**: 1 core / 2 GB / 40 GB SSD / unmetered — **$84/yr** (2 GB, over budget)
- **Slice 4096**: 1 core / 4 GB / 80 GB SSD / unmetered — **$180/yr** (over budget)
- 2-core "High Volume" VPS: 2 cores / 8 GB / 160 GB SSD / unmetered — $30/mo = $360/yr
- IPv4 included; **truly unmetered** 1 Gbps

**Onboarding** (★★★☆☆):
- Frantech-owned (Canada); account creation at my.frantech.ca
- **PayPal or crypto** only (no card directly for some plans historically)
- KYC minimal; provisioning manual/slow — often **hours**, not minutes
- Stallion control panel is functional but minimal

**Docker ergonomics** (★★★★☆):
- Full KVM, dedicated CPU, no overselling
- Docker explicitly supported; 100+ OS templates
- Less automation than major providers; no API equivalent to Hetzner
- Full disk encryption supported out of the box

**GDPR + DPA** (★★★☆☆):
- No published ISO 27001 / GDPR DPA from a quick check
- Luxembourg = EU jurisdiction, GDPR applies
- Limited DPA process; small company (Frantech)
- Privacy policy exists but is less formal than hyperscalers

**Reliability** (★★★★☆):
- 3,500 Gbps DDoS protection (Corero) — best-in-class, $3/IP/mo add-on
- Track record: very stable; known community favorite for budget unmetered
- Status: informal; some past storage incidents

**Real user sentiment** (★★★★☆):
- Loved on r/lowendspirit, r/selfhosted for "unmetered bandwidth at low cost"
- Common complaints: **support is slow**, account creation process is dated
- Known for being a "mom and pop" operation at scale; small but reliable

**Verdict**: Doesn't fit the budget at the 4 GB tier ($180/yr). The Slice 2048 at 2 GB RAM is the closest but still $84/yr and under-spec. **Exclude** unless the user can accept 2 GB RAM (then it's the best unmetered value at $84/yr).

---

## Comparison matrix

| Provider | Spec (vCPU/RAM/SSD) | €/yr (in-budget) | EU DC | KYC | ISO 27001 | DPA | DDoS | Sentiment |
|----------|---------------------|------------------|-------|-----|-----------|-----|------|-----------|
| **Hetzner CX23** | 2/4/40 | ~€72 | FSN/NBG/HEL | Sometimes | ✅ + C5 | ✅ | ✅ | ★★★☆☆ |
| **Contabo VPS 4** | 4/8/100 | €66 (24-mo) | NBG | No | ✅ | ✅ | ✅ Free | ★★☆☆☆ |
| **Netcup VPS 500 G12** | 2/4/128 | ~€71 | NUE/VIE/AMS | **Yes** | ✅ + 27018 + 27701 | ✅ | ✅ | ★★★★☆ |
| **Scaleway PRO2-S** | 2/4/40 | ~€48 (verify) | MIL/PAR/AMS/WAW | Sometimes | ✅ + HDS | ✅ | ✅ | ★★★★☆ |
| **OVH VPS-1** | 2/4/40 | ~€78 | RBX/SBG/GRA/LIM | **Yes** | ✅ + SecNumCloud | ✅ | ✅ | ★★★☆☆ |
| **IONOS VPS S+** | 2/2/90 | ~€55 | DE/UK/US | Yes | ✅ | ✅ | ✅ | ★★☆☆☆ |
| **BuyVM Slice 2048** | 1/2/40 | ~€84 (USD) | LU | No | ❌ | ❓ | $3 add-on | ★★★★☆ |

## Weighted scoring (price 25%, onboarding 20%, Docker 20%, GDPR 20%, sentiment 15%)

| Provider | Price (25%) | Onboarding (20%) | Docker (20%) | GDPR (20%) | Sentiment (15%) | **Total /5** |
|----------|-------------|------------------|--------------|------------|-----------------|--------------|
| Hetzner CX23 | 4 | 3 | 5 | 5 | 3 | **4.05** |
| Contabo VPS 4 | 5 | 4 | 3 | 4 | 2 | **3.70** |
| Netcup VPS 500 G12 | 4 | 2 | 5 | 5 | 4 | **4.00** |
| **Scaleway PRO2-S** | **5** | **4** | **5** | **5** | **4** | **4.65** |
| OVH VPS-1 | 4 | 3 | 4 | 5 | 3 | **3.80** |
| IONOS VPS S+ | 5 | 3 | 3 | 4 | 2 | **3.50** |
| BuyVM Slice 2048 | 3 | 3 | 4 | 3 | 4 | **3.40** |

> **Winner**: **Scaleway** — perfect storm of price, sovereignty, GDPR certs, and Italian DC. The "Milan DC + HDS cert" combination is unique.
> **Runner-up**: **Hetzner** (if you can stomach the KYC risk and stock issues) or **Netcup** (if Scaleway's PRO2-S price has crept above budget).

---

## RECOMMENDATION

### Primary pick: **Scaleway General Purpose / Development — PRO2-S in Paris (PAR1) or Amsterdam (AMS1), ideally Milan (MIL1) if available**

**Signup URL**: https://console.scaleway.com/register?service=console
**Server SKU**: PRO2-S (or the equivalent tier matching "2 vCPU shared, 4 GB RAM, 40 GB SSD" in their current product line — the SKU is `PRO2-S` in PAR1)
**Project**: One project, region Milan (MIL1) or Paris (PAR1) for EU data residency

**Why Scaleway** (3 paragraphs):

**1. Sovereignty & GDPR are unmatched in this price range.** Scaleway is the only candidate with both an Italian DC (Milan/MIL1) *and* HDS certification (the French healthcare data hosting standard that is one of the strictest in the EU). For an ODV/ETS handling **minors' data and health-related camp signups**, the HDS cert provides a defensible compliance story that an Italian regulator will recognize. Combined with ISO 27001 + 27017 + 27018, Scaleway's compliance posture is enterprise-grade at a self-service price. The fact that **Airbus migrated 70 critical apps from AWS to Scaleway in July 2026** specifically for digital sovereignty is meaningful third-party validation of the platform's ability to handle sensitive workloads. Italian visitors to wwfcrotone.it will see single-digit ms latency from Milan.

**2. The price is right and the provisioning is friction-free.** The PRO2-S (or current equivalent "2 vCPU / 4 GB / 40 GB SSD" shared tier) is the cheapest candidate that meets all the hard requirements (2+ vCPU, 4+ GB RAM, 40+ GB SSD, EU residency, IPv4 included, in the €50–80/yr range — verify the exact current price at signup, as Scaleway does tweak pricing). Provisioning takes seconds via the console or CLI; SSH key auto-accepted. KYC is not consistently enforced for sub-€100/mo accounts, so a solo dev opening an account should sail through. The console is modern and Terraform-friendly — useful if Elisey ever wants to move from "manual" to "IaC" without lock-in.

**3. Docker ergonomics + no vendor lock-in.** Docker CE installs cleanly on any Scaleway Linux image; private VPC networks are free; the platform supports cloud-init for a fully scripted setup. The stack described (Next.js standalone + Postgres 16 + Redis 7 + Nginx) maps 1:1 to the PRO2-S for the ~5,000 pageview/month traffic profile. If traffic grows 10× during camp sign-up week, you can vertically resize (or move to a dedicated instance like GP1-S) without rebuilding. And if you ever want to leave, you can: it's a plain KVM VPS with no proprietary orchestration tying you in. Combined with your free-tier stack (Cloudflare, R2, Brevo, Sentry, UptimeRobot, Instatus) and the domain already at Aruba, this is a fully EU-sovereign setup with zero managed-service lock-in.

### Fallback: **Netcup VPS 500 G12** in Nuremberg (NUE)

If Scaleway's PRO2-S has crept above budget when you check at signup, **Netcup VPS 500 G12** (2 vCore / 4 GB DDR5 ECC / 128 GB NVMe, €5.91/mo incl. 19% VAT = ~€71/yr) is the most defensible alternative. ISO 27001 + **27018 (PII protection) + 27701 (privacy)** is the best cert portfolio for a GDPR-sensitive NGO. Nuremberg DC is well-connected to Italy (~25–35 ms). The trade-off: **KYC is mandatory** (passport/ID + address proof upload) — budget 1–2 days for verification. ISO 27018 in particular is the one cert that maps directly to handling minors' health-adjacent data.

**Netcup signup**: https://www.netcup.com/en/server/vps
**SKU**: VPS 500 G12, region Nuremberg (NUE), 12-month pre-pay for best price

### Avoid for this use case

- **IONOS**: No exact 4 GB tier; aggressive renewal pricing; poor community sentiment
- **BuyVM**: Over budget at 4 GB RAM ($180/yr); USD billing is awkward for an Italian ODV; small operator (Frantech/Cloudzy)
- **Hetzner**: Still excellent but **KYC and 173% price hikes in 2026 have changed the calculus**; FSN1 stock issues are real; only pick this if Milan DC is unavailable at Scaleway AND you accept the KYC risk
- **Contabo**: Reputation risk outweighs €6 savings — the support / performance complaints are consistent and this is GDPR-sensitive data

---

## Sources

- Hetzner price adjustment 15 June 2026: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
- Hetzner press release: https://www.hetzner.com/pressroom/standardization-and-price-adjustment-of-our-server-products/
- Contabo Core VPS: https://contabo.com/en/vps/
- Netcup VPS: https://www.netcup.com/en/server/vps
- Scaleway General Purpose: https://www.scaleway.com/en/general-purpose-instances/
- OVHcloud VPS: https://www.ovhcloud.com/en/vps/
- IONOS VPS: https://www.ionos.com/servers/vps
- BuyVM KVM Slices: https://buyvm.net/kvm-dedicated-server-slices/
- r/selfhosted / r/hetzner / r/VPS community threads (June–August 2026) on price hikes, KYC, and reliability
- OVH 55% price hike discussion: r/sysadmin, "OVH raises prices. My new offer is 55.1% higher" (5 months ago, 323 upvotes)
- Airbus → Scaleway migration: The Register / r/BuyFromEU, July 2026
- r/de_EDV "Warum wird IONOS so gehasst?" (1 month ago, 48 upvotes)
