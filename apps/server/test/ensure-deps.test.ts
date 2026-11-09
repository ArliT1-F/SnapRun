import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rootDir } from '../src/config';
import {
  buildInstallPlan,
  checkNodeVersion,
  ensureDependencies,
  findMissingDependencies,
} from '../../../scripts/ensure-deps.mjs';

describe('workspace dependency bootstrap guard', () => {
  it('passes silently when workspace packages and binaries are already installed', () => {
    expect(findMissingDependencies(rootDir)).toEqual([]);
    let called = false;
    const result = ensureDependencies({
      rootDir,
      nodeVersion: '22.12.0',
      runCommand: () => {
        called = true;
        return { status: 0, error: undefined };
      },
    });
    expect(called).toBe(false);
    expect(result).toEqual({ installed: false, missing: [] });
  });

  it('detects missing tsc and concurrently in an uninitialized checkout', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'snaprun-deps-'));
    try {
      const missing = findMissingDependencies(tempRoot, 'linux');
      expect(missing).toContain('bin:tsc');
      expect(missing).toContain('bin:concurrently');
      expect(missing).toContain('pkg:typescript');
      expect(missing).toContain('pkg:concurrently');
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('forces devDependencies installation even when NODE_ENV=production or omit=dev is set', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'snaprun-plan-'));
    try {
      const installPlan = buildInstallPlan(
        tempRoot,
        {
          NODE_ENV: 'production',
          npm_config_omit: 'dev',
          npm_config_production: 'true',
        },
        '/usr/bin/node',
        'linux',
      );
      expect(installPlan.label).toBe('npm install --include=dev');
      expect(installPlan.command).toBe('npm');
      expect(installPlan.args).toEqual(['install', '--include=dev']);
      expect(installPlan.env.NODE_ENV).toBe('development');
      expect(installPlan.env.npm_config_omit).toBeUndefined();
      expect(installPlan.env.npm_config_production).toBeUndefined();
      expect(installPlan.env.SNAPRUN_SKIP_ENSURE_DEPS).toBe('1');

      writeFileSync(join(tempRoot, 'package-lock.json'), '{}');
      const ciPlan = buildInstallPlan(tempRoot, {}, '/usr/bin/node', 'win32');
      expect(ciPlan.label).toBe('npm ci --include=dev');
      expect(ciPlan.command).toBe('npm.cmd');
      expect(ciPlan.shell).toBe(true);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('validates the minimum Node.js 22.12 runtime version', () => {
    expect(checkNodeVersion('20.18.0')).toBe(false);
    expect(checkNodeVersion('22.11.9')).toBe(false);
    expect(checkNodeVersion('22.12.0')).toBe(true);
    expect(checkNodeVersion('24.1.0')).toBe(true);
    expect(() =>
      ensureDependencies({
        rootDir,
        nodeVersion: '20.18.0',
      }),
    ).toThrow(/Node\.js >=22\.12\.0 is required/);
  });
});
