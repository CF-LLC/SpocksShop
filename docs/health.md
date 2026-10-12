# Site health (`/admin/health`)

Checklist, worst state shown at the top:

| Check | Source | Warn / fail |
| --- | --- | --- |
| App | process uptime, Node version | — |
| Database | `select 1` latency | warn > 500 ms, fail if unreachable |
| Migrations | latest row in `schema_migrations`, compared with `drizzle/*.sql` in the image | warn if any are pending |
| Last backup | `app_status.last_backup` written by `scripts/backup.sh` | warn > 36 h, fail if never |
| Tunnel | `CLOUDFLARED_METRICS_URL` + `/ready` if set and reachable; otherwise HTTPS GET of `APP_URL/api/health` (through Cloudflare) | fail on non-200 |
| Pending listings | `community_listings.status = 'pending'` | warn if > 0 |
| Orders | today (America/Chicago) and last 7 days | — |

Below that: the last 20 `error_log` entries.

## Error logging

`lib/errors/log.ts` → `logError(source, error, context)` writes to `error_log` and never throws. Keys that look like secrets (password, token, cookie, session, …) are redacted.

- `instrumentation.ts` `onRequestError` logs every server error Next.js captures (pages, route handlers, server actions) with method and path only, never headers.
- Admin form handlers log unexpected errors and show a friendly message.

`/api/health` is a public liveness probe returning `{ ok, database }` (no other details).
