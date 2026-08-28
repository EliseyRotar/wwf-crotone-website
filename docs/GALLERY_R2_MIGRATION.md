# Gallery → Cloudflare R2 migration

## What changed

Gallery uploads no longer write to `public/uploads/gallery/`. They
upload directly to a Cloudflare R2 bucket (`wwf-gallery`) and the public
URL is served from a custom domain (`gallery.wwfcrotone.it`).

This closes the **only remaining public-write attack surface** in the
admin panel (the previous `/uploads/` nginx block served any uploaded
file with no auth check).

## Architecture

```
Admin uploads via /api/admin/upload (superadmin only)
       │
       ▼
uploadGalleryImage() (src/lib/r2Gallery.ts)
       │
       ▼
PUT https://wwf-gallery.<r2-endpoint>/gallery/<year>/<uuid>.<ext>
       │  (signed with SigV4 using scoped token)
       ▼
Cloudflare R2 stores the object
       │
       ▼
Browser requests https://gallery.wwfcrotone.it/gallery/<year>/<uuid>.<ext>
       │
       ▼
Cloudflare CDN serves with Cache-Control: public, immutable, 1 year
```

## Why two buckets

- `wwf-receipts` (existing) — private, accessed only through a
  session-checked proxy at `/api/admin/iscrizioni/[id]/receipt/...`
- `wwf-gallery` (new) — public-read via custom domain, no auth proxy

This separation lets us scope two different R2 API tokens:
- Receipts token: `Object Read & Write` on `wwf-receipts` only
- Gallery token: `Object Read & Write` on `wwf-gallery` only

A breach of one token cannot affect the other bucket.

## R2 setup (one-time, manual in Cloudflare dashboard)

1. **Create the bucket**
   - Cloudflare dashboard → R2 → Create bucket
   - Name: `wwf-gallery`
   - Location hint: (default / global)

2. **Custom domain**
   - Bucket → Settings → Public access → Custom domain
   - Add `gallery.wwfcrotone.it`
   - Cloudflare will give you a CNAME record to add to your DNS zone
   - Wait ~30s for propagation

3. **CORS** (allows browser-direct uploads from `https://wwfcrotone.it`)
   ```bash
   cat > /tmp/cors.json <<'EOF'
   [{
     "AllowedOrigins": ["https://wwfcrotone.it", "https://www.wwfcrotone.it"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": [],
     "ExposeHeaders": ["Content-Length", "ETag"],
     "MaxAgeSeconds": 3600
   }]
   EOF
   npx wrangler r2 bucket cors set wwf-gallery --file /tmp/cors.json
   ```

4. **Scoped API token**
   - R2 → Manage R2 API Tokens → Create API token
   - Permissions: **Object Read & Write**
   - Bucket scope: **Apply to specific buckets → wwf-gallery**
   - Save the Access Key + Secret Key

5. **Add to `/srv/wwf/.env.production`**
   ```
   R2_GALLERY_BUCKET=wwf-gallery
   R2_GALLERY_PUBLIC_BASE=https://gallery.wwfcrotone.it
   ```
   (The `AWS_*` vars are shared with the receipts token — both buckets
   live under the same R2 account, so the same access key works for
   both. If you want hard isolation, create a separate token and env
   vars `R2_GALLERY_*_KEY`.)

## Deploy

After deploying the new app code:

```bash
# 1. Confirm the new code is live
curl -sk https://wwfcrotone.it/api/health

# 2. Run the backfill to migrate existing /uploads/gallery/* files
ssh deploy@159.195.42.18
cd /srv/wwf
docker exec -w /app infra-app-1 node scripts/migrate-gallery-to-r2.mjs
```

The backfill script:
- Reads every file in `/srv/wwf/assets/uploads/gallery/`
- Looks up the corresponding `GalleryItem.src` row
- Uploads each file to R2 with key `gallery/<year>/<new-uuid>.<ext>`
- Updates the DB row's `src` to the new public URL
- Deletes the local file (best-effort)
- Idempotent (skips rows already migrated)

Expected output:
```
Found 13 files in /srv/wwf/assets/uploads/gallery/
Migrated /uploads/gallery/abc123.jpg -> https://gallery.wwfcrotone.it/gallery/2026/...
Migrated /uploads/gallery/def456.png -> https://gallery.wwfcrotone.it/gallery/2026/...
...
=== Done ===
Migrated: 13
Skipped:  0
Errors:   0
```

## Verification

```bash
# 1. Public URLs work
curl -skI https://gallery.wwfcrotone.it/gallery/2026/<uuid>.jpg

# 2. Old /uploads/ now 404s
curl -skI https://wwfcrotone.it/uploads/gallery/abc.jpg
# → HTTP/1.1 404 Not Found

# 3. New uploads work via the admin panel
# → log into /admin → Gallery → Upload → pick a photo
# → check the response src starts with https://gallery.wwfcrotone.it/

# 4. DB shows new URLs
docker exec infra-postgres-1 psql -U wwf -d wwf -c \
  "SELECT id, substr(src, 1, 60) FROM \"GalleryItem\" LIMIT 5;"
```

## Magic-byte checks (audit-recommended)

The admin upload route at `src/app/api/admin/upload/route.ts` now does
strict format checks, not just MIME-from-upload-form:

- **PNG**: full 8-byte signature `89 50 4E 47 0D 0A 1A 0A`
- **JPEG**: `FF D8 FF` + valid SOF marker (APP0/JFIF, APP1/Exif, quant table, Huffman, SOF0-SOF15)
- **GIF**: `GIF87a` or `GIF89a` literal
- **WebP**: `RIFF` + 4 bytes + `WEBP` (rejects `.wav`, `.avi` etc. that share the RIFF container)
- **MP4**: `ftyp` at offset 4 + recognised major brand (`isom`, `iso2`, `mp41`, `mp42`, `avc1`, `M4V `, `M4A `, `qt  `, `dash`, `mp71`)

## File map

| File | Purpose |
|---|---|
| `src/lib/r2Gallery.ts` | New helper, mirrors `src/lib/r2Upload.ts` for the gallery bucket |
| `src/app/api/admin/upload/route.ts` | Rewritten to call `uploadGalleryImage()` instead of writing to `public/` |
| `src/app/api/admin/gallery/route.ts` | Validators accept new R2 URLs; DELETE also calls `deleteGalleryImage()` |
| `infra/nginx/conf.d/app.conf` | `/uploads/` now returns 404 (was serving files with no auth) |
| `scripts/migrate-gallery-to-r2.mjs` | One-shot backfill script |
| `docs/GALLERY_R2_MIGRATION.md` | This file |

## Rollback

If you need to roll back (e.g. R2 outage):

```bash
# 1. Disable the new nginx /uploads/ 404 by reverting
#    infra/nginx/conf.d/app.conf and reloading nginx

# 2. Re-run the backfill script with --reverse (TODO if needed)
#    Currently the script has no --reverse mode. For a true rollback,
#    manually rewrite GalleryItem.src back to /uploads/gallery/<old-uuid>.ext
#    and re-upload the files from R2 to local.
```

In practice: R2 is more reliable than your VPS disk. **No rollback
planned.**
