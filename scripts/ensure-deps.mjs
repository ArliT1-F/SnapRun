import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_NODE_MAJOR = 22;
export const MIN_NODE_MINOR = 12;

const WORKSPACE_DIRS = ['.', 'apps/web', 'apps/server', 'apps/desktop', 'packages/shared'];

const REQUIRED_BINS = ['concurrently', 'tsc', 'vite', 'tsx', 'tsup', 'vitest', 'prettier', 'tauri'];

const REQUIRED_PACKAGES = [
  'concurrently',
  'typescript',
  'prettier',
  'playwright-core',
  'react',
  'vite',
  'vitest',
  'express',
  '@electric-sql/pglite',
  'tsx',
  'tsup',
  '@tauri-apps/cli',
  '@snaprun/shared',
];

export function checkNodeVersion(version = process.versions.node) {
  const [majorStr = '0', minorStr = '0'] = version.replace(/^v/, '').split('.');
  const major = Number.parseInt(majorStr, 10);
  const minor = Number.parseInt(minorStr, 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return false;
  return major > MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_MINOR);
}

function hasBinary(rootDir, binName, platform) {
  const candidates = platform === 'win32' ? [`${binName}.cmd`, binName] : [binName];
  return WORKSPACE_DIRS.some((dir) =>
    candidates.some((name) => existsSync(resolve(rootDir, dir, 'node_modules', '.bin', name))),
  );
}

function hasPackage(rootDir, packageName) {
  return WORKSPACE_DIRS.some((dir) =>
    existsSync(resolve(rootDir, dir, 'node_modules', ...packageName.split('/'), 'package.json')),
  );
}

export function findMissingDependencies(rootDir, platform = process.platform) {
  const missing = [];
  for (const bin of REQUIRED_BINS) {
    if (!hasBinary(rootDir, bin, platform)) {
      missing.push(`bin:${bin}`);
    }
  }
  for (const pkg of REQUIRED_PACKAGES) {
    if (!hasPackage(rootDir, pkg)) {
      missing.push(`pkg:${pkg}`);
    }
  }
  return missing;
}

export function buildInstallPlan(
  rootDir,
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
) {
  const subcommand = existsSync(resolve(rootDir, 'package-lock.json')) ? 'ci' : 'install';
  const npmArgs = [subcommand, '--include=dev'];
  const npmExecPath = env.npm_execpath;
  const useNodeExec =
    typeof npmExecPath === 'string' && /\.(c|m)?js$/i.test(npmExecPath) && existsSync(npmExecPath);

  const childEnv = { ...env };
  delete childEnv.npm_config_omit;
  delete childEnv.NPM_CONFIG_OMIT;
  delete childEnv.npm_config_production;
  delete childEnv.NPM_CONFIG_PRODUCTION;
  childEnv.NODE_ENV = 'development';
  childEnv.SNAPRUN_SKIP_ENSURE_DEPS = '1';

  return {
    label: `npm ${npmArgs.join(' ')}`,
    command: useNodeExec ? execPath : platform === 'win32' ? 'npm.cmd' : 'npm',
    args: useNodeExec ? [npmExecPath, ...npmArgs] : npmArgs,
    shell: !useNodeExec && platform === 'win32',
    env: childEnv,
  };
}

export function ensureDependencies({
  rootDir = fileURLToPath(new URL('../', import.meta.url)),
  env = process.env,
  execPath = process.execPath,
  platform = process.platform,
  nodeVersion = process.versions.node,
  runCommand = spawnSync,
  logger = console,
} = {}) {
  if (env.SNAPRUN_SKIP_ENSURE_DEPS === '1') {
    return { installed: false, missing: [] };
  }

  if (!checkNodeVersion(nodeVersion)) {
    throw new Error(
      `[snaprun] Node.js >=${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0 is required (detected v${nodeVersion}).`,
    );
  }

  const missing = findMissingDependencies(rootDir, platform);
  if (missing.length === 0) {
    return { installed: false, missing: [] };
  }

  const plan = buildInstallPlan(rootDir, env, execPath, platform);
  const summary = missing.slice(0, 4).join(', ') + (missing.length > 4 ? ', ...' : '');
  logger.error(`[snaprun] Missing workspace dependencies (${summary}); running "${plan.label}"...`);

  const result = runCommand(plan.command, plan.args, {
    cwd: rootDir,
    env: plan.env,
    stdio: 'inherit',
    shell: plan.shell,
  });

  if (result.error || result.status !== 0) {
    const detail = result.error ? ` (${result.error.message})` : '';
    throw new Error(
      `[snaprun] Automatic dependency installation failed${detail}. Run "${plan.label}" from the repository root.`,
    );
  }

  const remaining = findMissingDependencies(rootDir, platform);
  if (remaining.length > 0) {
    throw new Error(
      `[snaprun] Dependencies remain missing after "${plan.label}": ${remaining.join(', ')}.`,
    );
  }

  return { installed: true, missing };
}

const isMain =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  try {
    ensureDependencies();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
