FROM postgres:16-alpine

# Install wal-g for continuous base backups + WAL archiving to Cloudflare R2.
# wal-g-pg-24.04-amd64 is built on Ubuntu 24.04 (glibc 2.39) but works
# fine on Alpine because it statically links the only glibc dependency.
ARG WALG_VERSION=v3.0.8
RUN apk add --no-cache curl ca-certificates bash \
    && curl -fsSL "https://github.com/wal-g/wal-g/releases/download/${WALG_VERSION}/wal-g-pg-24.04-amd64.tar.gz" -o /tmp/wal-g.tar.gz \
    && tar xzf /tmp/wal-g.tar.gz -C /usr/local/bin/ \
    && mv /usr/local/bin/wal-g-pg-24.04-amd64 /usr/local/bin/wal-g \
    && chmod +x /usr/local/bin/wal-g \
    && rm /tmp/wal-g.tar.gz \
    && wal-g --version

# Make sure archive_mode can be turned on via the docker-entrypoint wrapper.
# We enable archive_mode by passing -c archive_mode=on -c archive_command=...
# as the postgres command-line args. See docker-compose.yml.
