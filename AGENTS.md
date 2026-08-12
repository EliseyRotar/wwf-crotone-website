# WWF Crotone Website — AGENTS.md

## Build & Dev Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript checking
- `npm run db:push` — push Prisma schema to DB
- `npm run db:seed` — seed 12 turns + gallery
- `npm run db:studio` — Prisma Studio GUI

## Tech Stack
- Next.js 15 App Router + TypeScript
- Tailwind CSS 3 (dark mode via CSS variables)
- Prisma + SQLite (dev) / PostgreSQL (prod)
- next-intl for IT/EN i18n
- JWT auth (jose) with bcryptjs
- Nodemailer via Gmail SMTP

## Key Conventions
- Server components by default, `"use client"` only when needed
- All colors use CSS variables defined in globals.css (light/dark)
- i18n: all user-facing strings in src/messages/{it,en}.json
- Admin panel is Italian-only (WWF internal staff)
- Public site is bilingual IT/EN
- All API routes validate input with zod
- Rate limiting via in-memory token bucket (src/lib/rateLimit.ts)
- File uploads validated by magic bytes (not just MIME type)

## Important Files
- `prisma/schema.prisma` — all DB models
- `src/lib/auth.ts` — JWT session + cookie management
- `src/lib/site.ts` — site config (email, phone, social links)
- `src/middleware.ts` — locale routing
- `next.config.js` — CSP headers + i18n plugin
- `tailwind.config.js` — WWF design tokens
## Git / GitHub workflow (CRITICAL — read before any commit)

The user wants every change to register as contributions on their GitHub
profile (the green dots). To make that happen:

1. **Authenticate with `gh` as the user** before touching git:
   ```
   echo "<PAT>" | gh auth login --with-token
   gh auth setup-git
   ```
   The PAT lives at `/home/eli6/Documents/wwf-secrets.env` → `GH_PAT`.

2. **Author identity MUST match a verified email on the GitHub account**.
   The user `EliseyRotar` has these verified emails:
   - `nutellaelik@gmail.com` (primary, public)
   - `121826592+EliseyRotar@users.noreply.github.com` (noreply)

   Use:
   ```
   git config user.name "EliseyRotar"
   git config user.email "nutellaelik@gmail.com"
   ```

   **NEVER** set the author to `eliseyrotar@gmail.com` or any other
   unverified address — those commits will not count on the contribution
   graph.

3. **Push to `main` on `EliseyRotar/wwf-crotone-website`** using the
   remote that ships in the repo (`origin`). The remote URL embeds the
   PAT so `git push` from this machine just works.

4. **One logical commit per change**, with a descriptive message that
   matches the repo's existing convention (see `git log --oneline`):
   `feat(scope): …`, `fix(scope): …`, `chore: …`, `docs: …`.

5. **Don't commit unless the user asked** (existing AGENTS.md rule).
   When they do ask, batch related files into one commit, but push
   each commit individually so each shows up as a separate green dot.

6. After pushing, **verify** with `gh api repos/EliseyRotar/wwf-crotone-website/commits?per_page=5`
   to confirm the commit landed and counts toward contributions.
