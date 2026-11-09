import type { SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process';

export const MIN_NODE_MAJOR: number;
export const MIN_NODE_MINOR: number;

export function checkNodeVersion(version?: string): boolean;

export function findMissingDependencies(rootDir: string, platform?: NodeJS.Platform): string[];

export interface InstallPlan {
  label: string;
  command: string;
  args: string[];
  shell: boolean;
  env: NodeJS.ProcessEnv;
}

export function buildInstallPlan(
  rootDir: string,
  env?: NodeJS.ProcessEnv,
  execPath?: string,
  platform?: NodeJS.Platform,
): InstallPlan;

export interface EnsureDependenciesOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  execPath?: string;
  platform?: NodeJS.Platform;
  nodeVersion?: string;
  runCommand?: (
    command: string,
    args: readonly string[],
    options: SpawnSyncOptions,
  ) => Pick<SpawnSyncReturns<Buffer>, 'status' | 'error'>;
  logger?: Pick<Console, 'error'>;
}

export function ensureDependencies(options?: EnsureDependenciesOptions): {
  installed: boolean;
  missing: string[];
};
