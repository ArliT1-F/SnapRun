# SnapRun

**Your space, in sync.** A working, privacy-conscious Snapchat companion built with React, TypeScript, Vite, Tailwind CSS, Node.js, PostgreSQL and Tauri 2.

SnapRun organizes **your own contacts and companion preferences**. It opens Snapchat’s official website for authentication and messaging. It is not a private Snapchat API client, does not collect Snapchat passwords, and does not fabricate conversations or claim that opening a website verifies a connection.

> Status: working web application and API, complete desktop source and packaging workflow. Native Linux/Windows artifacts must be built on the corresponding native runners; they are not included as prebuilt binaries in this checkout. See [Delivery status](docs/DELIVERY.md).

## Start locally

Requires Node.js **22.12+** and npm.

```bash
npm ci
npm run dev
```

Open **http://localhost:5173**. The API listens on port 3001; Vite proxies `/api`, including WebSockets. Development uses persistent **PGlite** (PostgreSQL compiled to WASM) in `.data/`, with a locally generated encryption key. No database service is needed for this local preview. PGlite is refused in production.

You can explore as a guest immediately. Guest contacts are **session-only**; create a companion account for encrypted persistence and cross-device sync. A SnapRun account is separate from Snapchat.

## Production database

```bash
cp .env.example .env
# Set DATABASE_URL, HTTPS APP_ORIGIN, ALLOWED_ORIGINS and a random ENCRYPTION_KEY.
docker compose up -d postgres
npm run db:migrate
npm run build
npm start
```

For a same-origin deployment set `SERVE_WEB=true`; the Node service then serves the built React app and API. Put it behind an HTTPS reverse proxy. See [Installation](docs/INSTALLATION.md) and [Environment](.env.example).

## What works

- Responsive dark/light/system themes, keyboard shortcuts and command search.
- First-launch Snapchat sign-up/sign-in choices, official external handoff and recovery guidance.
- Explicit provider capabilities; no fake message list, send box, unread Snapchat counts or synchronization claims.
- Companion registration/login, expiring sessions, logout, export and password-confirmed deletion.
- Manually maintained contacts, notes, usernames, labels, search, filtering and grid/list views.
- AES-256-GCM application-layer encryption for account contacts and preference/activity payloads.
- PostgreSQL schema/migrations, REST validation, rate limits, origin checks and authenticated WebSocket sync.
- Companion-only notification history and browser/native notification preferences.
- Tauri 2 tray, native notifications, global shortcut, autostart and non-sensitive preference cache.

## Commands

| Command                          | Purpose                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                    | Web + API development                                           |
| `npm run typecheck`              | Strict TypeScript checks                                        |
| `npm test`                       | Backend, provider and shared-schema tests                       |
| `npm run build`                  | Production web and server bundles                               |
| `npm run test:browser`           | Browser smoke test against a running app; requires Chromium     |
| `npm run db:migrate`             | Apply SQL migrations                                            |
| `npm run desktop:dev`            | Native development shell + local services                       |
| `npm run desktop:build -- linux` | Linux packages; requires Rust/native SDKs and `DESKTOP_APP_URL` |
| `npm run desktop:build -- win32` | Windows packages on Windows                                     |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Installation & deployment](docs/INSTALLATION.md)
- [Desktop builds](docs/DESKTOP.md)
- [Integration compatibility report](docs/INTEGRATION_REPORT.md)
- [Security assessment](docs/SECURITY.md)
- [Testing & verification](docs/TESTING.md)
- [Delivery status and limitations](docs/DELIVERY.md)

## Non-negotiable boundaries

No unofficial Snapchat endpoints, credential interception, automated Snapchat registration, device-identity spoofing, fingerprint manipulation, ban evasion, CAPTCHA solving or security-check circumvention. The contradictory list in the original specification’s section 7 was explicitly corrected to a prohibition. The reviewed unofficial repositories are **research references only**, not dependencies.

SnapRun is independent and not affiliated with or endorsed by Snap Inc.
