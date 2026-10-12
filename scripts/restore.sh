#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILE="$(realpath "${1:?Usage: scripts/restore.sh ~/backups/spockshop/spocks-shop-YYYYMMDDThhmmssZ.sql.gz}")"
cd "$REPO_DIR"

if [[ "$FILE" == *.gz ]]; then
  WORK="$(mktemp)"
  gunzip -c "$FILE" > "$WORK"
else
  WORK="$FILE"
fi

if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" < "$WORK"
else
  docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$WORK"
fi

echo "Restore complete from $FILE"
