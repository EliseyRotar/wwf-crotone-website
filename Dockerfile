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

RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app/.next

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"] 
