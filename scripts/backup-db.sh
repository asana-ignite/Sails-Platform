#!/bin/bash
# KLAO Platform - Database Backup Script
# Generates full data dump and schema-only dump from local PostgreSQL Docker container.

set -e

BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating full database backup (Data + Schemas)..."
docker exec -t klao-db pg_dump -U postgres -d postgres --clean --if-exists --create > "$BACKUP_DIR/full_database_backup.sql"

echo "📐 Creating DDL schema-only backup..."
docker exec -t klao-db pg_dump -U postgres -d postgres --schema-only > "$BACKUP_DIR/schema_only_backup.sql"

echo "✅ Backup successfully created in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"
