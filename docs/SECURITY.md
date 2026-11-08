# Security assessment

Assessment date: **2026-11-07**. This is an engineering review of the delivered code, not an independent penetration test or certification.

## Assets and trust boundaries

Protected assets are companion credentials/sessions, manually entered contacts and notes, preferences/labels, activity history and the integrity of connection-status claims. Snapchat credentials and private conversations are intentionally outside the system’s trust boundary: they are never collected.

Trust boundaries:

- Browser/native UI → same-origin REST API and authenticated WebSocket.
- API → PostgreSQL (or explicitly development-only PGlite).
- Companion → official Snapchat website through an external handoff only.
- Tauri remote UI → narrowly scoped native capabilities on the configured first-party origin.

## Implemented controls

### Authentication and sessions

- Companion passwords: salted Node.js scrypt hashes; minimum 12 characters. No plaintext password storage.
- Sessions: 32 random bytes; only SHA-256 hashes stored server-side.
- HttpOnly, SameSite=Lax cookies; Secure in production; new token on login.
- Absolute expiry (default seven days) and 24-hour idle expiry; WebSocket heartbeat checks both.
- Logout revokes the current session. Account deletion revokes all owned sessions and cascades owned data.
- Login failures are generic; a dummy hash is checked for unknown accounts.
- Registration, failed authentication and general API rate limits are enabled outside explicitly configured tests.

### Request and account isolation

- Zod schemas reject malformed input and unknown fields, including nested settings objects.
- Exact origin checks protect cookie-authenticated mutations; production requires HTTPS configuration.
- Every private query scopes data to the authenticated user. Cross-account update/delete/read-notification tests pass.
- JSON body limit, UUID validation, contact/label/event limits and WebSocket connection/payload limits reduce abuse.
- Helmet headers and a same-origin CSP are applied when the API serves the UI. No Snapchat iframe or credential form is embedded.

### Data protection

- AES-256-GCM with random 96-bit IVs and a versioned AAD protects contact, settings and event payloads before database storage.
- Authentication tags are verified on decryption; tampering tests pass.
- Production requires a 32-byte key supplied as 64 hex characters. Development keys are generated locally and ignored by Git.
- Companion session hashes and password hashes are excluded from data export and synchronization.
- Desktop preference cache excludes contacts, labels, passwords and tokens. Privacy Mode clears/disables that cache and removes the browser `snaprun.preferences` cache.
- Guest contacts remain in memory and disappear when the page session ends; they are not silently merged into a new account.

### Privacy Mode

- Settings include a Privacy Mode master switch, notification redaction control, local-data wipe and a data/permissions audit.
- System/lock-screen notifications can be redacted to a generic SnapRun update; Privacy Mode forces redaction on.
- One-click local wipe removes only SnapRun-owned browser storage, clears the desktop preference cache, attempts server logout, resets the workspace to a session-only guest and leaves Privacy Mode enabled in memory.
- If logout cannot reach the server, the local wipe still runs, but the HttpOnly session cookie cannot be revoked client-side; the UI tells the user to reconnect and sign out again.
- The audit states that SnapRun does not collect device identifiers, hardware fingerprints, analytics, camera/microphone/location data or Snapchat credentials/messages. It also discloses that standard HTTP metadata still reaches the host and that Snapchat sees the real device.
- Privacy Mode is data minimization, not anonymity or device impersonation. It does not bypass Snapchat device checks, locks or restrictions.

### Integration integrity

- No unofficial dependency, private endpoint, Snapchat token field, browser credential extraction or automated Snapchat registration exists.
- Provider capabilities explicitly disable private messaging access and verification.
- Official URL allowlists exist in both the web adapter and Rust opener command.
- Self-reported connection notes cannot become `verified` through the API.
- No device spoofing, fingerprint manipulation, ban evasion, CAPTCHA bypass, authentication interception or security-check circumvention is implemented.

## Residual risks and required deployment work

1. **Compromised client/device:** application-layer encryption does not hide data from malicious code running as the signed-in user or from the API while decrypting owned data. Keep the UI dependencies and native webview patched.
2. **Key management:** the key and database must be protected separately. There is no in-app key rotation or recovery escrow. Losing the key loses encrypted payload readability.
3. **Backups:** live account deletion does not rewrite historical backups. Establish retention, access controls and restore-time deletion handling before public launch.
4. **Database/disk encryption:** payload encryption does not encrypt every metadata column, WAL file or backup. Use disk/volume encryption, TLS database connections and least-privilege database roles.
5. **Rate limiting:** the current store is process-local. Use a shared store before horizontally scaling the API. Apply edge abuse controls and monitor registration volume.
6. **Proxy configuration:** set an exact trusted-hop count and overwrite forwarding headers at the proxy. Incorrect trust configuration can undermine client-IP rate limiting.
7. **Session operations:** there is no password-reset/email-verification flow, MFA, administrator console or all-device session-management UI yet. These are launch-readiness items, not silently assumed features.
8. **Native distribution:** release signing, certificate custody, SmartScreen reputation, crate lockfile review and OS-specific permission tests remain required.
9. **Official service availability:** Snapchat may change its web experience, eligibility or device support. SnapRun cannot guarantee registration/login success and does not diagnose private Snapchat errors.
10. **Encryption context:** the current AAD identifies the payload format/version, not an individual tenant. A database administrator with the key can still manipulate rows; database access control remains essential.

## Explicitly prohibited

The original section 7 contained an “Implement” list that contradicted the rest of the specification. It has been corrected to a prohibition. None of its bypass/interception/impersonation features is present, and the referenced unofficial repository is not a dependency.

## Pre-release checklist

- Run CI against real PostgreSQL and both native desktop runners.
- Review and commit the generated Cargo lockfile; run dependency and native supply-chain audits.
- Configure HTTPS, exact origins, trusted proxy hops, database TLS and secret management.
- Test notification/autostart/tray permissions on target Linux desktop environments and Windows.
- Perform an independent web/API security review and abuse-case testing.
- Configure package signing and backup retention; publish a real privacy policy and support contact.
