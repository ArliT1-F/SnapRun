import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import type { Config } from './config';
export type QueryResult<T> = { rows: T[]; rowCount: number };
export interface Database {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}
export async function createDatabase(config: Config): Promise<Database> {
  if (config.driver === 'pglite') {
    const instance = await PGlite.create(
      config.dataDir === ':memory:' ? undefined : `${config.dataDir}/postgres`,
    );
    let queue: Promise<unknown> = Promise.resolve();
    const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
      const next = queue.then(fn, fn);
      queue = next.catch(() => undefined);
      return next;
    };
    const query: Database['query'] = async (sql, params = []) => {
      const r = await instance.query(sql, params);
      return {
        rows: r.rows as never,
        rowCount: /^\s*(SELECT|SHOW|EXPLAIN|VALUES|TABLE)\b/i.test(sql)
          ? r.rows.length
          : (r.affectedRows ?? 0),
      };
    };
    const db: Database = {
      kind: 'pglite',
      exec: async (sql) => {
        await serialize(() => instance.exec(sql));
      },
      query: (sql, params = []) => serialize(() => query(sql, params)),
      transaction: (fn) =>
        serialize(async () => {
          const scoped: Database = {
            kind: 'pglite',
            query,
            exec: (sql) => instance.exec(sql).then(() => undefined),
            transaction: (nested) => nested(scoped),
            close: async () => undefined,
          };
          await instance.exec('BEGIN');
          try {
            const result = await fn(scoped);
            await instance.exec('COMMIT');
            return result;
          } catch (error) {
            await instance.exec('ROLLBACK');
            throw error;
          }
        }),
      close: () => instance.close(),
    };
    return db;
  }
  const pool = new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
  });
  pool.on('error', () => console.error('PostgreSQL idle connection failed'));
  await pool.query('SELECT 1');
  return {
    kind: 'postgres',
    exec: async (sql) => {
      await pool.query(sql);
    },
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async transaction<T>(fn: (db: Database) => Promise<T>) {
      const client = await pool.connect();
      const scoped: Database = {
        kind: 'postgres',
        exec: async (sql) => {
          await client.query(sql);
        },
        query: async (sql, params = []) => {
          const r = await client.query(sql, params);
          return { rows: r.rows, rowCount: r.rowCount ?? 0 };
        },
        transaction: (fn) => fn(scoped),
        close: async () => client.release(),
      };
      try {
        await client.query('BEGIN');
        const result = await fn(scoped);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
