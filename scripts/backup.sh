#!/usr/bin/env bash
# Nightly Postgres backup for the Docker Compose stack.
#   - pg_dump inside the db container (no host pg tools needed)
#   - gzip + integrity check, keep 14 days in BACKUP_DIR
#   - record the result in app_status('last_backup') for /admin/health
# Usage: bash scripts/backup.sh          (run from anywhere; uses the repo's compose project)
# Env:   BACKUP_DIR (default ~/backups/spockshop), RETENTION_DAYS (default 14),
#        COMPOSE_PROJECT_NAME (default: compose's own default for this folder)
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/spockshop}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/spocks-shop-$STAMP.sql.gz"
PARTIAL="$FILE.partial"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

compose() { docker compose "$@"; }
psql_db() { compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' ; }

cleanup() { rm -f "$PARTIAL"; }
trap cleanup EXIT

# Dump using the container's own credentials; the password never touches this script.
compose exec -T db sh -c 'pg_dump --no-owner --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$PARTIAL"
gzip -t "$PARTIAL"
BYTES="$(stat -c %s "$PARTIAL")"
if [ "$BYTES" -lt 1024 ]; then
  echo "Backup looks empty ($BYTES bytes); keeping previous backups untouched." >&2
  exit 1
fi
mv "$PARTIAL" "$FILE"

# Retention: only our own files, only older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'spocks-shop-*.sql.gz' -mtime "+$((RETENTION_DAYS - 1))" -print -delete

NAME="$(basename "$FILE")"
AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf "insert into app_status (key, value, updated_at) values ('last_backup', jsonb_build_object('at', '%s', 'file', '%s', 'bytes', %s), now())
on conflict (key) do update set value = excluded.value, updated_at = now();\n" "$AT" "$NAME" "$BYTES" | psql_db

echo "$AT wrote $FILE ($BYTES bytes)"
