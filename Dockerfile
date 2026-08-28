FROM node:20-alpine AS base

# node:20-alpine ships OpenSSL 3.x; Prisma 5.22 ships a debian-openssl-3
# engine variant that links against libssl3. Force the client generator
# to produce that engine so we don't need libssl.so.1.1 at runtime.
RUN apk add --no-cache openssl libssl3

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
# Force Prisma to emit the debian-openssl-3 engine so Alpine/libssl3 works.
ENV PRISMA_CLIENT_ENGINE_TYPE=debian-openssl-3.0.x
ENV PRISMA_CLI_ENGINE_TYPE=debian-openssl-3.0.x
# T3 Env validation runs at module load. Without these placeholder
# values, `next build` (which imports src/lib/auth.ts indirectly)
# would throw "Invalid environment variables" during page-data
# collection. These values are NEVER used at runtime — the runner
# stage gets real values from /srv/wwf/.env.production.
ENV SKIP_ENV_VALIDATION=true
ENV NODE_ENV=production
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV AUTH_SECRET=ci-build-only-placeholder-not-used-in-production-xxxxxxxxxxxxxxxxx
ENV GROQ_API_KEY=ci-build-only
ENV AWS_ENDPOINT=https://ci.r2.example.com
ENV AWS_ACCESS_KEY_ID=ci-build-only
ENV AWS_SECRET_ACCESS_KEY=ci-build-only
ENV POSTGRES_PASSWORD=ci-build-only
ENV SMTP_HOST=smtp.ci.example.com
ENV SMTP_PORT=587
ENV SMTP_SECURE=false
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget openssl libssl3
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Order matters: copy the full deps module first, then overlay the
# builder-generated artifacts (.prisma + @prisma) on top of the deps
# node_modules. This keeps bcryptjs/jose/etc. available to seed.ts
# while ensuring the auto-generated Prisma client wins.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Cron script + its CommonJS env helper. Both needed by the cron
# container (the app container never runs scripts/status-poll.js but
# it's cheap to include). env-script.cjs is CJS so the cron can
# require() it from inside the ESM status-poll.js via createRequire.
COPY --from=builder /app/scripts ./scripts

RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Note: the Dockerfile-level HEALTHCHECK below is correct for the `app`
# service (Next.js HTTP server on :3000). The `cron` service reuses
# this image but doesn't run an HTTP server, so it overrides the
# healthcheck via `healthcheck:` in infra/docker-compose.yml. If you
# add a new service to compose that reuses this image, give it its
# own healthcheck block — don't rely on this default.
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
