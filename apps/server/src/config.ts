import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
export const rootDir = fileURLToPath(new URL('../../../', import.meta.url));
dotenv.config({ path: resolve(rootDir, '.env'), quiet: true });
export type Config = ReturnType<typeof loadConfig>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const production = env.NODE_ENV === 'production';
  const driver = env.DB_DRIVER ?? (production ? 'postgres' : 'pglite');
  if (!['postgres', 'pglite'].includes(driver))
    throw new Error('DB_DRIVER must be postgres or pglite');
  if (production && driver !== 'postgres')
    throw new Error('Production requires PostgreSQL; PGlite is development-only');
  if (production && !env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (production && !env.APP_ORIGIN?.startsWith('https://'))
    throw new Error('Production APP_ORIGIN must use HTTPS');
  const dataDir = resolve(rootDir, env.DATA_DIR || '.data');
  let encryptionKey = env.ENCRYPTION_KEY;
  if (!encryptionKey && !production) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    const keyPath = resolve(dataDir, 'development.key');
    if (!existsSync(keyPath))
      writeFileSync(keyPath, randomBytes(32).toString('hex'), { mode: 0o600 });
    encryptionKey = readFileSync(keyPath, 'utf8').trim();
  }
  if (!encryptionKey || !/^[a-fA-F0-9]{64}$/.test(encryptionKey))
    throw new Error('ENCRYPTION_KEY must contain exactly 32 bytes encoded as 64 hex characters');
  const sessionDays = Number(env.SESSION_DAYS ?? 7);
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 30)
    throw new Error('SESSION_DAYS must be between 1 and 30');
  const origins = (env.ALLOWED_ORIGINS || env.APP_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const u = new URL(origin);
    if (u.origin !== origin || !['http:', 'https:'].includes(u.protocol))
      throw new Error('Invalid ALLOWED_ORIGINS entry');
  }
  return {
    production,
    driver: driver as 'postgres' | 'pglite',
    databaseUrl: env.DATABASE_URL || '',
    databaseSsl: env.DATABASE_SSL === 'true',
    port: Number(env.PORT || 3001),
    appOrigin: env.APP_ORIGIN || 'http://localhost:5173',
    allowedOrigins: origins,
    encryptionKey: Buffer.from(encryptionKey, 'hex'),
    dataDir,
    sessionDays,
    trustProxy: Math.max(0, Number(env.TRUST_PROXY || 0)),
    serveWeb: env.SERVE_WEB === 'true',
    rateLimitDisabled: !production && env.DISABLE_RATE_LIMIT_FOR_TESTS === 'true',
  };
}
