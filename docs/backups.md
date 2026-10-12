# Backups

`scripts/backup.sh` dumps the database from the running `db` container (`pg_dump` inside the container, using its own credentials), gzips it, checks the archive, and keeps **14 days** of `spocks-shop-*.sql.gz` files in `BACKUP_DIR` (default `~/backups/spockshop`). It then records `{at, file, bytes}` in the `app_status` table (`key = 'last_backup'`), which `/admin/health` shows. Health warns when the last backup is older than 36 hours.

Run it by hand from the server:

```bash
cd ~/sites/spockshop
bash scripts/backup.sh
```

Env overrides: `BACKUP_DIR`, `RETENTION_DAYS`, `COMPOSE_PROJECT_NAME` (set this if you started the stack with `-p <name>` and the folder name differs).

> Note: `.env` has `BACKUP_DIR=/var/spocks/backups` for the app container. The script ignores `.env` and uses its own default on the host, so no sudo is needed.

## Install as a user crontab (not installed yet)

Daily at 3:15 AM server time:

```bash
mkdir -p ~/backups/spockshop
crontab -l 2>/dev/null > /tmp/cron.current || true
echo '15 3 * * * cd $HOME/sites/spockshop && COMPOSE_PROJECT_NAME=spockshop PATH=/usr/local/bin:/usr/bin:/bin bash scripts/backup.sh >> $HOME/backups/spockshop/backup.log 2>&1' >> /tmp/cron.current
crontab /tmp/cron.current && rm /tmp/cron.current
crontab -l
```

The user must be in the `docker` group (cron runs without a login shell). Check results in `~/backups/spockshop/backup.log` and on `/admin/health`.

Backups live on the same disk as the database. Copy them off the machine periodically (e.g. `rsync` to another computer or cloud storage).

## Restore

```bash
cd ~/sites/spockshop
bash scripts/restore.sh ~/backups/spockshop/spocks-shop-YYYYMMDDThhmmssZ.sql.gz
```

Dumps are made with `--clean --if-exists`, so restoring replaces the current tables. Take a fresh backup first.
