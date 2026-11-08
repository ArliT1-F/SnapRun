# Testing and verification

## Automated checks

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit
```

Backend tests use isolated in-memory PGlite by default. CI also runs the same suite against a real PostgreSQL 16 service:

```bash
DB_DRIVER=postgres DATABASE_URL=postgresql://user:password@host:5432/test_db npm run test -w @snaprun/server
```

Coverage includes:

- registration/login validation, generic credential failures and duplicate accounts;
- password hashing, raw-token absence, idle session expiry and fresh login;
- origin rejection and unauthenticated access;
- encrypted contact storage and tamper detection;
- cross-account contact/update/delete/notification isolation;
- settings revisions, conflict responses and label-reference cleanup;
- official capability declarations, handoff-only status and self-reported confirmation;
- export exclusions, password-confirmed deletion and cascading cleanup;
- authenticated WebSocket upgrade, invalidation hints and anonymous rejection;
- provider URL restrictions, blocked-pop-up handling and keyboard modifiers;
- nested unknown-field rejection and local contact search;
- legacy settings compatibility for new privacy defaults, Privacy Mode protection derivation, notification redaction and selective SnapRun-only storage wiping.

## Browser smoke test

Start the app, install a matching Chromium once, then run:

```bash
npx playwright@1.65.0 install chromium
npm run test:browser
```

For an existing Chromium binary:

```bash
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

`BASE_URL` defaults to `http://127.0.0.1:5173`. The script creates a unique companion account and deletes it in `finally`. It exercises guest contacts, onboarding without a Snapchat password field, registration, labels, theme persistence, account-backed contact persistence, Privacy Mode cache removal, local wipe/guest reset, notification read state, official handoff, self-reported status, command search and mobile overflow. It intercepts `window.open` so tests do not authenticate to or automate Snapchat.

## Native tests still required

The Tauri source, icons, capability files and platform CI workflow are delivered, but native compilation/installation was not run in this sandbox (no Rust or platform SDKs). Before release:

- Build and install Linux DEB/RPM/AppImage and Windows NSIS/MSI artifacts.
- Verify tray show/quit, close/minimize behavior and global shortcut conflicts.
- Grant/deny notification permission and confirm companion-only notifications, including redacted lock-screen content.
- Enable/disable autostart and inspect the OS registration.
- Run Privacy Mode local wipe and confirm `preferences.json` is cleared while account/server data remains intact.
- Confirm the release remote capability applies only to the configured first-party origin.
- Confirm official links open in the system browser and arbitrary URLs are rejected.
- Sign packages and test updater/distribution policy if an updater is introduced later.

See [VERIFICATION.md](VERIFICATION.md) for the checks actually run in this environment. Do not interpret a successful Vite build as a successful Tauri build.
