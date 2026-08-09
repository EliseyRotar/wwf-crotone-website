FROM postgres:16-alpine

# Install wal-g for continuous base backups + WAL archiving to Cloudflare R2.
# wal-g binaries are dynamically linked against glibc; Alpine uses musl, so we
# install the glibc compatibility layer (gcompat) to bridge the gap.
ARG WALG_VERSION=v3.0.8
RUN apk add --no-cache curl ca-certificates bash gcompat \
    && curl -fsSL "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-24.04-amd64.tar.gz" -o /tmp/wal-g.tar.gz \
    && tar xzf /tmp/wal-g.tar.gz -C /usr/local/bin/ \
    && mv /usr/local/bin/wal-g-pg-24.04-amd64 /usr/local/bin/wal-g \
    && chmod +x /usr/local/bin/wal-g \
    && rm /tmp/wal-g.tar.gz \
    && wal-g --version
