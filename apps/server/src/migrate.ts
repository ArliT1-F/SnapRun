import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, type Database } from './db';

export async function migrate(db: Database) {
  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );
  const dir = fileURLToPath(new URL('../migrations/', import.meta.url));
  for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
    await db.transaction(async (tx) => {
      if ((await tx.query('SELECT name FROM schema_migrations WHERE name = $1', [name])).rowCount)
        return;
      await tx.exec(await readFile(resolve(dir, name), 'utf8'));
      await tx.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
    });
  }
}
