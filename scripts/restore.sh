#!/usr/bin/env bash
# I6: PostgreSQL restore script.
# Usage: ./scripts/restore.sh path/to/backup.sql.gz
# Drops and recreates the public schema before importing.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "ERROR: backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "WARNING: this will overwrite the database pointed to by DATABASE_URL."
echo "Database: ${DATABASE_URL}"
read -r -p "Type 'yes' to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "Dropping and recreating public schema..."
psql "${DATABASE_URL}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}" --set ON_ERROR_STOP=on

echo "Restore complete."
