# Deploying the API to the VPS

The Express API at `https://api.hasagold.store` stores application data in
Neon PostgreSQL and verifies user identity with Firebase Authentication. The
frontend sends all customer and admin requests to this API; it never connects
to Neon directly. This guide covers the backend only — the frontend is deployed
and verified separately.

## Production layout

| Item | Value |
| ---- | ----- |
| Host | `ubuntu@137.23.42.221` |
| SSH key | `$env:USERPROFILE\.ssh\pathum-topup-vps` |
| App directory | `/var/www/hasa-gold-api` |
| Process manager | PM2, app name `hasa-gold-api` |
| Listener | `127.0.0.1:3000` (nginx terminates TLS and proxies to it) |
| Env file | `/var/www/hasa-gold-api/.env` (mode `600`, BOM-free) |

## Do not run the legacy cutover script

`deploy-neon-vps.ps1` re-syncs the frozen legacy Firestore catalog into Neon
and overwrites live store settings — payment methods, eZ Cash account details
and FAQs. It has already caused production configuration to be reverted once.
The script now aborts immediately with an explanation, and the migration
utility it used is quarantined in [`legacy/`](./legacy).

The live API is Neon-only. Deploy source files and apply SQL migrations
instead.

## Deploy changed source files

Copy only the files that changed, syntax-check them on the server, then
restart PM2:

```powershell
Set-Location 'E:\Hasa Gold Store\hasastore\hasa-gold-api'
$key = "$env:USERPROFILE\.ssh\pathum-topup-vps"

scp -i $key '.\src\app.js' ubuntu@137.23.42.221:/var/www/hasa-gold-api/src/
ssh  -i $key ubuntu@137.23.42.221 'cd /var/www/hasa-gold-api && node --check src/app.js && pm2 restart hasa-gold-api --update-env && pm2 save'
```

If `package.json` or `package-lock.json` changed, copy them as well and install
before restarting:

```powershell
scp -i $key '.\package.json' '.\package-lock.json' ubuntu@137.23.42.221:/var/www/hasa-gold-api/
ssh  -i $key ubuntu@137.23.42.221 'cd /var/www/hasa-gold-api && npm ci --omit=dev'
```

`--update-env` makes PM2 re-read `.env`; `pm2 save` persists the process list
across reboots (`pm2-ubuntu.service` is already enabled).

## Apply schema changes

Schema lives in [`sql/schema.sql`](./sql/schema.sql) and
[`sql/migrations/`](./sql/migrations). Apply a migration with `psql` against
Neon, then verify the API still reports healthy. Never re-run the legacy
Firestore import to "refresh" data.

## Verify

Success requires all of the following:

- `GET https://api.hasagold.store/health` returns HTTP 200 (this also checks
  the PostgreSQL connection).
- `GET https://api.hasagold.store/v1/catalog` returns active games, products
  and settings from Neon.
- PM2 reports `hasa-gold-api` online.
- The response headers include `Cache-Control: no-store…`, `X-Frame-Options:
  DENY`, `X-Content-Type-Options: nosniff`, HSTS with `includeSubDomains`, and
  `Server: nginx` with no version.

```sh
curl -s https://api.hasagold.store/health
curl -s -o /dev/null -w '%{http_code}\n' https://api.hasagold.store/v1/catalog
curl -s -I https://api.hasagold.store/health | grep -Ei 'server:|cache-control|x-frame|x-content-type|strict-transport'
```

If verification fails, inspect `pm2 logs hasa-gold-api` before retrying. Do
not delete PM2 logs or the release directory while diagnosing.

## Frontend deployment

This guide deploys the API only. The frontend defaults to
`https://api.hasagold.store` and attaches Firebase ID tokens to authenticated
requests. Deploy the reviewed frontend build through the site's hosting
provider, then smoke-test sign-in, catalog, profile, wallet, orders and admin
pages. Do not consider the full production site switched until that frontend
build is deployed and verified.
