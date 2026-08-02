#!/usr/bin/env bash
# I6: PostgreSQL backup script.
# Usage: ./scripts/backup.sh
# Produces a timestamped pg_dump file in ./backups/

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT}/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/pg-${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

echo "Backing up database to ${OUT}"
pg_dump "${DATABASE_URL}" | gzip > "${OUT}"

echo "Backup complete: $(du -h "${OUT}" | cut -f1)"

# Retain 30 days of backups
find "${BACKUP_DIR}" -type f -name "pg-*.sql.gz" -mtime +30 -delete
echo "Old backups (>30 days) pruned."
