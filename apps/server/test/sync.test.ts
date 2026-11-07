import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createDatabase } from '../src/db';
import { loadConfig } from '../src/config';
import { migrate } from '../src/migrate';
import { createApp } from '../src/app';
import { attachSync } from '../src/sync';
import { defaultSettings } from '@snaprun/shared';
describe('authenticated application synchronization', () => {
  it('rejects anonymous upgrades and broadcasts settings hints without payloads or credentials', async () => {
    const origin = 'http://localhost:5173';
    const config = {
      ...loadConfig({
        NODE_ENV: 'test',
        DB_DRIVER: 'pglite',
        ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        APP_ORIGIN: origin,
        DISABLE_RATE_LIMIT_FOR_TESTS: 'true',
      }),
      dataDir: ':memory:',
    };
    const db = await createDatabase(config);
    await migrate(db);
    let sync: ReturnType<typeof attachSync> | undefined;
    const hub = {
      broadcast: (...args: Parameters<ReturnType<typeof attachSync>['broadcast']>) =>
        sync?.broadcast(...args),
      closeSessions: (...args: Parameters<ReturnType<typeof attachSync>['closeSessions']>) =>
        sync?.closeSessions(...args),
      close: async () => {
        await sync?.close();
      },
    };
    const app = await createApp(db, config, hub);
    const server = createServer(app);
    sync = attachSync(server, db, config);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    const url = `ws://127.0.0.1:${address.port}/api/sync`;
    let ws: WebSocket | undefined;
    try {
      const anonymous = new WebSocket(url, { headers: { Origin: origin } });
      const [error] = await once(anonymous, 'error');
      expect(String(error)).toContain('401');
      const registration = await request(app)
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({
          email: 'sync@example.test',
          password: 'sync-companion-password',
          displayName: 'Sync',
        });
      const headers = registration.headers as unknown as { 'set-cookie': string[] };
      const cookie = headers['set-cookie'][0]!.split(';')[0] ?? '';
      ws = new WebSocket(url, { headers: { Origin: origin, Cookie: cookie } });
      const [ready] = await once(ws, 'message');
      expect(JSON.parse(String(ready)).type).toBe('ready');
      const source = randomUUID();
      ws.send(JSON.stringify({ type: 'hello', clientId: source }));
      const received = once(ws, 'message');
      await request(app)
        .put('/api/settings')
        .set('Origin', origin)
        .set('Cookie', cookie)
        .set('X-Client-Id', randomUUID())
        .send({ settings: { ...defaultSettings, theme: 'light' }, revision: 1 })
        .expect(200);
      const [message] = await received;
      const hint = JSON.parse(String(message));
      expect(hint.type).toBe('settings');
      expect(hint.revision).toBe(2);
      expect(hint.source).not.toBe(source);
      expect(hint.settings).toBeUndefined();
      expect(hint.cookie).toBeUndefined();
    } finally {
      ws?.terminate();
      await sync?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  });
});
