#!/usr/bin/env bash
#
# SAILS full database backup — split into schema + data, timestamped.
#
# Usage:
#   ./scripts/backup-db.sh
#
# Output (in ./backups/):
#   sails_schema_YYYYMMDD_HHMMSS.sql   — structure only (schemas, tables, indexes, FKs, RLS policies)
#   sails_data_YYYYMMDD_HHMMSS.sql     — data only (COPY statements, all schemas incl. tenant schemas)
#
# Notes:
#   - Requires the sails-db container to be running.
#   - \restrict / \unrestrict wrapper lines emitted by newer pg_dump are stripped
#     so the files can be replayed with plain psql.
#   - Restore procedure: see docs/KB_UNLOADED_CONFIG.md (§ Restore).
#
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$ROOT_DIR/backups"
mkdir -p "$BACKUP_DIR"

SCHEMA_FILE="$BACKUP_DIR/sails_schema_${TIMESTAMP}.sql"
DATA_FILE="$BACKUP_DIR/sails_data_${TIMESTAMP}.sql"

if ! docker ps --format '{{.Names}}' | grep -q '^sails-db$'; then
  echo "ERROR: sails-db container is not running." >&2
  exit 1
fi

echo ">> Dumping schema  -> $SCHEMA_FILE"
docker exec sails-db pg_dump -U postgres -d postgres \
  --schema-only --no-owner --no-privileges \
  | grep -vE '^\\(restrict|unrestrict)' > "$SCHEMA_FILE"

echo ">> Dumping data    -> $DATA_FILE"
docker exec sails-db pg_dump -U postgres -d postgres \
  --data-only --no-owner --no-privileges --disable-triggers \
  | grep -vE '^\\(restrict|unrestrict)' > "$DATA_FILE"

echo ""
echo "Backup complete:"
ls -lh "$SCHEMA_FILE" "$DATA_FILE"
