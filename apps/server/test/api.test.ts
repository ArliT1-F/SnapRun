import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { createDatabase, type Database } from '../src/db';
import { loadConfig } from '../src/config';
import { migrate } from '../src/migrate';
import { createApp } from '../src/app';
import { decrypt, encrypt, hashPassword, hashToken, verifyPassword } from '../src/security';
import { defaultSettings, officialWebCapabilities } from '@snaprun/shared';
let db: Database;
let app: Express;
let alice: ReturnType<typeof request.agent>;
let bob: ReturnType<typeof request.agent>;
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
const post = (agent: ReturnType<typeof request.agent>, path: string, body: unknown) =>
  agent
    .post(path)
    .set('Origin', origin)
    .send(body as object);
const put = (agent: ReturnType<typeof request.agent>, path: string, body: unknown) =>
  agent
    .put(path)
    .set('Origin', origin)
    .send(body as object);
beforeAll(async () => {
  db = await createDatabase(config);
  await migrate(db);
  app = await createApp(db, config);
  alice = request.agent(app);
  bob = request.agent(app);
  await post(alice, '/api/auth/register', {
    email: 'alice@example.test',
    password: 'a-long-companion-password',
    displayName: 'Alice',
  }).expect(201);
  await post(bob, '/api/auth/register', {
    email: 'bob@example.test',
    password: 'another-companion-password',
    displayName: 'Bob',
  }).expect(201);
});
afterAll(async () => {
  await db?.close();
});
describe('application authentication and security boundaries', () => {
  it('uses a real PostgreSQL-compatible schema and health check', async () => {
    const r = await request(app).get('/api/health').expect(200);
    expect(r.body.database).toBe('pglite');
    expect((await db.query('SELECT name FROM schema_migrations')).rowCount).toBe(1);
  });
  it('rejects unauthenticated private data and cross-origin mutations', async () => {
    await request(app).get('/api/bootstrap').expect(401);
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({})
      .expect(403);
    await request(app).post('/api/auth/login').send({}).expect(403);
  });
  it('never stores plaintext companion passwords or raw session tokens', async () => {
    const u = await db.query<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(u.rows[0]?.password_hash).toMatch(/^scrypt:/);
    expect(JSON.stringify(u.rows)).not.toContain('a-long-companion-password');
    const s = await db.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(s.rows[0]?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(s.rows[0]?.token_hash).not.toHaveLength(43);
  });
  it('rejects weak passwords, extra fields and Snapchat credential collection', async () => {
    await post(request.agent(app), '/api/auth/register', {
      email: 'x@example.test',
      password: 'short',
      displayName: 'X',
    }).expect(400);
    await post(request.agent(app), '/api/auth/register', {
      email: 'x@example.test',
      password: 'long-enough-password',
      displayName: 'X',
      snapchatPassword: 'never',
    }).expect(400);
  });
  it('rejects incorrect credentials and duplicate registration', async () => {
    await post(request.agent(app), '/api/auth/login', {
      email: 'alice@example.test',
      password: 'wrong-password',
    }).expect(401);
    await post(request.agent(app), '/api/auth/register', {
      email: 'alice@example.test',
      password: 'a-long-companion-password',
      displayName: 'Alice',
    }).expect(409);
  });
  it('expires idle sessions and accepts a fresh login', async () => {
    const agent = request.agent(app);
    await post(agent, '/api/auth/register', {
      email: 'idle@example.test',
      password: 'a-long-companion-password',
      displayName: 'Idle',
    }).expect(201);
    await db.query(
      "UPDATE sessions SET last_seen_at=now()-interval '2 days' WHERE user_id=(SELECT id FROM users WHERE email='idle@example.test')",
    );
    await agent.get('/api/bootstrap').expect(401);
    await post(agent, '/api/auth/login', {
      email: 'idle@example.test',
      password: 'a-long-companion-password',
    }).expect(200);
  });
});
describe('encrypted contacts and synchronized preferences', () => {
  let contactId: string;
  it('creates encrypted, manually maintained contacts', async () => {
    const r = await post(alice, '/api/contacts', {
      displayName: 'Private Person',
      snapchatUsername: 'private.person',
      notes: 'A private local note',
      labelIds: [],
    }).expect(201);
    contactId = r.body.id;
    const stored = await db.query<{ ciphertext: string }>(
      'SELECT ciphertext FROM contacts WHERE id=$1',
      [contactId],
    );
    expect(stored.rows[0]?.ciphertext).toMatch(/^v1\./);
    expect(stored.rows[0]?.ciphertext).not.toContain('Private Person');
    expect(decrypt<{ notes: string }>(stored.rows[0]!.ciphertext, config.encryptionKey).notes).toBe(
      'A private local note',
    );
  });
  it('isolates contacts, updates and deletes between accounts', async () => {
    const r = await bob.get('/api/bootstrap').expect(200);
    expect(r.body.contacts).toEqual([]);
    await bob
      .patch(`/api/contacts/${contactId}`)
      .set('Origin', origin)
      .send({ displayName: 'Stolen', snapchatUsername: '', notes: '', labelIds: [] })
      .expect(404);
    await bob.delete(`/api/contacts/${contactId}`).set('Origin', origin).expect(404);
  });
  it('syncs explicit settings with optimistic concurrency', async () => {
    const next = { ...defaultSettings, theme: 'light' };
    const r = await put(alice, '/api/settings', { settings: next, revision: 1 }).expect(200);
    expect(r.body.revision).toBe(2);
    const conflict = await put(alice, '/api/settings', {
      settings: defaultSettings,
      revision: 1,
    }).expect(409);
    expect(conflict.body.settings.theme).toBe('light');
    expect((await bob.get('/api/bootstrap').expect(200)).body.settings.theme).toBe('dark');
  });
  it('removes deleted labels from encrypted contacts without orphaned references', async () => {
    const label = { id: randomUUID(), name: 'Temporary', color: 'blue' };
    await put(alice, '/api/settings', {
      settings: { ...defaultSettings, theme: 'light', labels: [label] },
      revision: 2,
    }).expect(200);
    await alice
      .patch(`/api/contacts/${contactId}`)
      .set('Origin', origin)
      .send({
        displayName: 'Private Person',
        snapchatUsername: 'private.person',
        notes: 'A private local note',
        labelIds: [label.id],
      })
      .expect(200);
    await put(alice, '/api/settings', {
      settings: { ...defaultSettings, theme: 'light', labels: [] },
      revision: 3,
    }).expect(200);
    const data = (await alice.get('/api/bootstrap').expect(200)).body;
    expect(data.contacts[0].labelIds).toEqual([]);
  });
  it('rejects unknown labels and malformed identifiers', async () => {
    await post(alice, '/api/contacts', {
      displayName: 'Person',
      snapchatUsername: '',
      notes: '',
      labelIds: [randomUUID()],
    }).expect(400);
    await alice
      .patch('/api/contacts/not-a-uuid')
      .set('Origin', origin)
      .send({ displayName: 'Person' })
      .expect(400);
  });
  it('marks notifications read only for their owner', async () => {
    const data = (await alice.get('/api/bootstrap')).body;
    const id = data.notifications[0].id;
    await bob.patch(`/api/notifications/${id}/read`).set('Origin', origin).send({}).expect(404);
    await alice.patch(`/api/notifications/${id}/read`).set('Origin', origin).send({}).expect(200);
  });
});
describe('honest official Snapchat integration', () => {
  it('advertises only implemented official handoffs', async () => {
    const r = await request(app).get('/api/integrations').expect(200);
    expect(r.body.providers[0].capabilities).toEqual(officialWebCapabilities);
    expect(r.body.providers[0].officialUrl).toBe('https://web.snapchat.com/');
    expect(r.body.providers[0].capabilities.sendMessage).toBe(false);
  });
  it('records a handoff without claiming authentication succeeded', async () => {
    const r = await post(alice, '/api/integrations/snapchat/handoff', { purpose: 'login' }).expect(
      200,
    );
    expect(r.body.connection.status).toBe('handoff_opened');
    expect(r.body.connection.verified).toBe(false);
    expect(r.body.url).toBe('https://web.snapchat.com/');
  });
  it('labels confirmation as self-reported and rejects verified claims', async () => {
    const r = await put(alice, '/api/integrations/snapchat/status', {
      status: 'user_confirmed',
    }).expect(200);
    expect(r.body.connection.verified).toBe(false);
    expect(r.body.connection.status).toBe('user_confirmed');
    await put(alice, '/api/integrations/snapchat/status', { status: 'verified' }).expect(400);
  });
});
describe('data portability and deletion', () => {
  it('exports only companion data, never credentials or session hashes', async () => {
    const r = await alice.get('/api/account/export').expect(200);
    expect(r.body.contacts).toHaveLength(1);
    expect(JSON.stringify(r.body)).not.toContain('password_hash');
    expect(JSON.stringify(r.body)).not.toContain('token_hash');
    expect(r.body.user.email).toBe('alice@example.test');
  });
  it('requires the companion password and deletes all owned rows', async () => {
    const uid = (await bob.get('/api/bootstrap')).body.user.id;
    await bob
      .delete('/api/account')
      .set('Origin', origin)
      .send({ password: 'incorrect', confirmation: 'DELETE' })
      .expect(403);
    await bob
      .delete('/api/account')
      .set('Origin', origin)
      .send({ password: 'another-companion-password', confirmation: 'DELETE' })
      .expect(200);
    for (const table of [
      'users',
      'sessions',
      'contacts',
      'preferences',
      'events',
      'integration_state',
    ]) {
      expect(
        (
          await db.query(
            `SELECT 1 FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'}=$1`,
            [uid],
          )
        ).rowCount,
      ).toBe(0);
    }
    await bob.get('/api/bootstrap').expect(401);
  });
});
describe('cryptographic primitives', () => {
  it('detects encrypted payload tampering', () => {
    const encoded = encrypt({ secret: 'local' }, config.encryptionKey);
    const parts = encoded.split('.');
    parts[2] = randomBytes(16).toString('base64url');
    expect(() => decrypt(parts.join('.'), config.encryptionKey)).toThrow();
  });
  it('uses unique salts and constant-time password comparison', async () => {
    const a = await hashPassword('same-long-password');
    const b = await hashPassword('same-long-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-long-password', a)).toBe(true);
    expect(await verifyPassword('wrong', b)).toBe(false);
    expect(hashToken('token')).toHaveLength(64);
  });
  it('refuses insecure production configuration', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DB_DRIVER: 'pglite' })).toThrow();
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DB_DRIVER: 'postgres',
        DATABASE_URL: 'postgres://localhost/db',
        APP_ORIGIN: 'http://localhost',
      }),
    ).toThrow();
  });
});
