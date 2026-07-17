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