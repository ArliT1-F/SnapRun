# Desktop development and packaging

## Prerequisites

- Node.js 22.12+ and npm dependencies (`npm ci`).
- Rust stable through rustup, including Cargo.
- Linux: a C/C++ toolchain, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libappindicator3-dev`/`libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, and `rpm` for RPM packaging.
- Windows: Visual Studio Build Tools with the C++ workload and Microsoft Edge WebView2 Runtime.
- A deployed HTTPS SnapRun origin for release packaging.

Tauri builds native code and cannot be validated by a web build alone.

## Development

```bash
npm run desktop:dev
```

This starts the companion API, Vite on port 1420 and the Tauri development window. The local API uses PGlite unless `.env` selects PostgreSQL. The development window can use the local guest workspace and companion account sync.

## Release packaging

Deploy the web/API first. Then select its exact origin:

Linux:

```bash
export DESKTOP_APP_URL=https://snaprun.example.com
npm run desktop:build -- linux
```

Windows PowerShell:

```powershell
$env:DESKTOP_APP_URL = "https://snaprun.example.com"
npm run desktop:build -- win32
```

The script rejects insecure origins, credentials in URLs and paths/query strings. It generates a temporary window configuration and a capability scoped to that first-party origin, invokes Tauri, and removes the temporary files afterward.

Output directories:

```text
apps/desktop/src-tauri/target/release/bundle/deb/
apps/desktop/src-tauri/target/release/bundle/rpm/
apps/desktop/src-tauri/target/release/bundle/appimage/
apps/desktop/src-tauri/target/release/bundle/nsis/
apps/desktop/src-tauri/target/release/bundle/msi/
```

The installed release loads your deployed SnapRun app, not Snapchat, as its first-party UI. This keeps session cookies first-party and lets web/desktop share the same backend. It requires network access for account features; it is not an offline message archive.

## Native behavior

- Tray: Open SnapRun / Quit SnapRun; optional close/minimize to tray.
- Notifications: companion events only, after explicit permission.
- Global shortcut: configurable show/focus combination.
- Autostart: explicit opt-in through the OS plugin.
- Preference cache: theme, language, reduced motion and desktop behavior only.
- External authentication: system browser, official Snapchat HTTPS destinations only.

Linux tray behavior depends on the desktop environment’s StatusNotifier/AppIndicator support. Native notification and autostart behavior must be tested on each target OS.

## CI and signing

`.github/workflows/desktop.yml` builds Linux on Ubuntu 22.04 and Windows on `windows-latest`, uploading separate artifacts. Run it manually with `app_url`, or set repository variable `SNAPRUN_APP_URL` for version tags.

Builds are unsigned by default. Configure Tauri’s platform signing secrets and certificate trust before public distribution. Windows SmartScreen reputation and Linux package/repository signing are release responsibilities.

The first native dependency resolution generates `Cargo.lock`; run the native builds, review the resolved crate versions, and commit that lockfile for reproducible releases. This sandbox had no Rust toolchain or native SDKs, so no native binary or Rust compilation result is claimed here.
