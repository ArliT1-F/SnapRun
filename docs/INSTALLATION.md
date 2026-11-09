# Installation and deployment

## Local development

1. Install Node.js 22.12 or newer.
2. Run `npm ci --include=dev` from the repository root (the root `dev`, `build`, `test` and `typecheck` scripts also run `scripts/ensure-deps.mjs` automatically if `node_modules` or `devDependencies` such as `tsc` and `concurrently` are missing).
3. Run `npm run dev`.
4. Open `http://localhost:5173`.

The default development driver is PGlite, persisted under `.data/postgres`. Its key is generated at `.data/development.key` with owner-only permissions on POSIX. These files are ignored by Git. Keep the key with the database if you want to reopen encrypted development data. Delete both only when you intentionally want a fresh local workspace.

The API binds to `0.0.0.0:3001` for container/preview compatibility. Vite binds to `0.0.0.0:5173` and proxies API and WebSocket traffic. Browser code uses relative URLs only. Do not expose the development server publicly; use a production deployment for untrusted networks.

## PostgreSQL setup

PGlite is a single-connection development convenience, not the production deployment model.

```bash
cp .env.example .env
```

Set at least:

```dotenv
NODE_ENV=production
DB_DRIVER=postgres
DATABASE_URL=postgresql://snaprun:YOUR_PASSWORD@db.example.com:5432/snaprun
DATABASE_SSL=true
APP_ORIGIN=https://snaprun.example.com
ALLOWED_ORIGINS=https://snaprun.example.com
ENCRYPTION_KEY=YOUR_64_HEX_CHARACTER_KEY
SERVE_WEB=true
TRUST_PROXY=1
```

Generate a key locally, without putting it in shell history or source control:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For local PostgreSQL, `compose.yaml` provides PostgreSQL 16 on loopback only. Set `POSTGRES_PASSWORD` and match it in `DATABASE_URL`, then:

```bash
docker compose up -d postgres
npm run db:migrate
npm run build
npm start
```

Migrations live in `apps/server/migrations`. The runner records applied filenames in `schema_migrations` and executes each new migration transactionally. Run migrations as a single deployment step before rolling out API instances. Development applies migrations automatically; production does not.

## Container

```bash
docker build -t snaprun .
docker run --rm -p 127.0.0.1:3001:3001 --env-file .env snaprun
```

The image contains the compiled API and web assets, runs as the non-root `node` user and exposes a health check. Terminate TLS at your reverse proxy. The container does not contain PostgreSQL.

Example Caddy site:

```caddyfile
snaprun.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Caddy handles HTTPS and WebSocket upgrades. Set `TRUST_PROXY` to the exact number of trusted proxy hops, not `true`. Configure the proxy to overwrite forwarded headers. Never trust arbitrary client-supplied forwarding headers directly.

## Sessions and origins

- `APP_ORIGIN` must be HTTPS in production.
- `ALLOWED_ORIGINS` is a comma-separated list of exact origins, without trailing slashes.
- Cookies are HttpOnly, SameSite=Lax and Secure in production.
- Sessions expire after `SESSION_DAYS` (default 7, maximum 30) and after 24 hours without authenticated HTTP activity.
- The production deployment should use one canonical origin. The desktop release loads that same first-party origin, avoiding third-party cookie dependence.

## Backups and key management

Back up PostgreSQL and the encryption key separately through your secret manager. Losing the key makes encrypted payloads unreadable; restoring an old key with a newer database can also break reads. Key rotation requires an offline decrypt/re-encrypt migration and is not implemented as an in-app action.

Account deletion removes live database rows through cascading foreign keys. It does not erase historical backups or snapshots. Define a backup retention/restore policy and document it to users before a public launch.

## Operational limits

Rate limiting currently uses the library’s process-local memory store. Multiple API replicas need a shared limiter store and coordinated deployment configuration. Each account is limited to 1,000 manually maintained contacts and 40 labels; notification history retains the latest 200 events. WebSocket connections are limited to five per account.
