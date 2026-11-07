# Architecture

## Monorepo

```text
apps/
  web/                 React 19 + TypeScript + Vite + Tailwind 4
    src/components/    Navigation, dialogs, reusable UI, activity
    src/pages/         Dashboard, Messages, Contacts, Notifications, Settings
    src/integrations/  Provider contract and official-web implementation
    src/lib/           REST client, workspace state, platform adapters
  server/              Express 5 REST API + authenticated WebSocket hints
    migrations/        Transactional PostgreSQL SQL migrations
    src/db.ts          PostgreSQL / development PGlite adapter
    src/security.ts    scrypt, session hashing, AES-256-GCM
  desktop/             Tauri 2 native shell and platform capabilities
packages/shared/       Zod schemas, settings, contacts, capability contract
scripts/               Reproducible desktop packaging and browser smoke test
docs/                  Deployment, security, research and verification
```

## Data ownership

There are three deliberately separate domains:

1. **Snapchat account data** — credentials, friends, conversations and security checks remain in Snapchat’s official interface.
2. **Companion account data** — email, display name, password hash, sessions, manually entered contacts, labels, preferences and companion events.
3. **Guest session data** — contacts/events in browser memory; non-sensitive appearance preferences in localStorage. Guest data is not silently uploaded on login.

The server never receives a Snapchat password or token. The official-web provider returns `outcome: opened, verified: false`. A user may save a self-reported signed-in note, but the API and UI never turn that into verified access.

## Provider model

`SnapchatProvider` declares an ID, display name, capability map and handoff method. `OfficialWebProvider` implements only:

- official authentication handoff;
- opening the official messaging experience.

It explicitly does not implement verified connection status, specific conversation links, sending/receiving, history, friends access or Snapchat message notifications. New providers must supply authorized implementations and update the capability contract rather than silently pretending unsupported operations succeeded.

The backend has no Snapchat HTTP client, endpoint map, bearer-token store or browser automation dependency.

## State and synchronization

The React workspace loads `/api/bootstrap` after session discovery. Settings changes are serialized per client and use a revision number. A stale write receives HTTP 409 and the latest settings instead of overwriting another device.

Authenticated `/api/sync` WebSockets carry small invalidation hints (`settings`, `contacts`, `notifications`, `connection`), not private payloads. Clients refetch authoritative REST data. A client identifier suppresses redundant echoes. Reconnect uses bounded exponential backoff; REST remains usable when WebSockets fail.

Synchronized data includes theme, language, shortcut preferences, notification preferences, desktop behavior, labels, manually maintained contacts and connection notes. Passwords, session tokens and Snapchat data are never synchronization payloads.

Deleting a label also removes its references from encrypted contacts in the same database transaction.

## Database

- `users`: companion identity and scrypt password hash.
- `sessions`: SHA-256 token hash, absolute expiry, last activity.
- `preferences`: encrypted settings JSON and positive revision.
- `contacts`: owner ID and encrypted contact payload.
- `events`: owner ID, event category, encrypted title/body, read state.
- `integration_state`: official-web status and handoff/self-report timestamps.
- `schema_migrations`: applied migration ledger.

All owned tables cascade on user deletion. Search happens client-side after the owner’s contacts are decrypted by the API; plaintext contact fields are not indexed in PostgreSQL.

PGlite and PostgreSQL share the SQL and adapter contract. PGlite serializes calls because it is single-connection; PostgreSQL uses a pool and checked-out transaction clients. Production rejects PGlite.

## Desktop boundary

Development loads the local Vite app through a proxy. Release packaging requires `DESKTOP_APP_URL`, an HTTPS first-party companion origin, and generates a remote capability restricted to that origin. The native app therefore uses the same first-party session cookies and API as the website. It is an installed native shell, not an offline Snapchat client; account features require the deployed service.

Rust exposes only a narrowly validated official-Snapchat URL opener plus scoped plugin permissions. The tray reads a non-sensitive desktop preference cache. Contacts, labels, companion passwords and authentication tokens are not written to that cache. OS browser/webview cookie storage handles companion sessions; no Snapchat credential is stored in an OS keychain because none is collected.

## Deliberate omissions

No fabricated inbox, unofficial SDK, Snapchat friend scraping, automated registration, security bypass, message archive, private endpoint assumptions or background Snapchat polling. Google OAuth is optional in the specification and visibly marked not configured; no nonfunctional “Sign in with Google” button is presented.
