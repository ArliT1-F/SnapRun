import { writeFile, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const value = process.env.DESKTOP_APP_URL;
if (!value)
  throw new Error(
    'Set DESKTOP_APP_URL to your deployed HTTPS SnapRun origin before packaging. See docs/DESKTOP.md.',
  );
const url = new URL(value);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== '/'
)
  throw new Error(
    'DESKTOP_APP_URL must be an HTTPS origin without credentials, path, query or fragment.',
  );
const configPath = `${root}apps/desktop/.desktop-config.json`;
const capabilityPath = `${root}apps/desktop/src-tauri/capabilities/remote.json`;
const window = {
  label: 'main',
  title: 'SnapRun',
  url: url.href,
  width: 1280,
  height: 900,
  minWidth: 800,
  minHeight: 620,
  center: true,
  theme: 'Dark',
  backgroundColor: '#111216',
};
const base = JSON.parse(
  await readFile(`${root}apps/desktop/src-tauri/capabilities/default.json`, 'utf8'),
);
await writeFile(configPath, JSON.stringify({ app: { windows: [window] } }, null, 2));
await writeFile(
  capabilityPath,
  JSON.stringify(
    {
      $schema: '../gen/schemas/desktop-schema.json',
      identifier: 'snaprun-first-party-remote',
      description: 'Native access restricted to the configured first-party companion origin',
      windows: ['main'],
      remote: { urls: [`${url.origin}/*`] },
      permissions: base.permissions,
    },
    null,
    2,
  ),
);
const platform = process.argv[2] ?? process.platform;
const bundles = platform === 'win32' ? 'nsis,msi' : platform === 'linux' ? 'deb,rpm,appimage' : '';
const args = [
  'tauri',
  'build',
  '--config',
  '.desktop-config.json',
  ...(bundles ? ['--bundles', bundles] : []),
];
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
      cwd: `${root}apps/desktop`,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  process.exitCode = code;
} finally {
  await rm(configPath, { force: true });
  await rm(capabilityPath, { force: true });
}
