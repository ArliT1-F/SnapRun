import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import {
  APP_VERSION,
  OFFICIAL_SNAPCHAT_WEB,
  contactInputSchema,
  credentialsSchema,
  defaultSettings,
  initialConnection,
  officialWebCapabilities,
  registerSchema,
  settingsSchema,
  type AppNotification,
  type ConnectionState,
  type Contact,
  type NotificationKind,
  type Settings,
  type SyncMessage,
  type WorkspaceData,
} from '@snaprun/shared';
import type { Config } from './config';
import { rootDir } from './config';
import type { Database } from './db';
import { decrypt, encrypt, hashPassword, hashToken, newToken, verifyPassword } from './security';
import { authMiddleware, createSession, idSchema, SESSION_COOKIE, sessionCookie } from './auth';
import type { SyncHub } from './sync';

type EventContent = { title: string; body: string };
type EventRow = {
  id: string;
  kind: NotificationKind;
  ciphertext: string;
  created_at: Date;
  read_at: Date | null;
};
type ContactRow = { id: string; ciphertext: string; created_at: Date; updated_at: Date };
const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
export async function createApp(db: Database, config: Config, sync?: SyncHub) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'ipc:', 'http://ipc.localhost'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.production ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    let sameDevOrigin = false;
    try {
      sameDevOrigin = !config.production && !!origin && new URL(origin).host === req.get('host');
    } catch {
      /* reject below */
    }
    if (!origin || (!config.allowedOrigins.includes(origin) && !sameDevOrigin)) {
      res
        .status(403)
        .json({ error: 'This request origin is not allowed.', code: 'ORIGIN_REJECTED' });
      return;
    }
    next();
  });
  const generalLimiter = rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.rateLimitDisabled,
    message: { error: 'Too many requests. Please wait a moment.', code: 'RATE_LIMITED' },
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    skip: () => config.rateLimitDisabled,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.', code: 'RATE_LIMITED' },
  });
  app.use('/api', generalLimiter);
  const userId = (req: Request) => req.auth!.user.id;
  const source = (req: Request) => {
    const value = req.get('x-client-id');
    return value && idSchema.safeParse(value).success ? value : 'server';
  };
  const emit = (req: Request, type: SyncMessage['type'], revision?: number) =>
    sync?.broadcast(userId(req), { type, source: source(req), revision });
  async function addEvent(
    tx: Database,
    uid: string,
    kind: NotificationKind,
    content: EventContent,
  ) {
    const id = randomUUID();
    await tx.query('INSERT INTO events(id,user_id,kind,ciphertext) VALUES ($1,$2,$3,$4)', [
      id,
      uid,
      kind,
      encrypt(content, config.encryptionKey),
    ]);
    await tx.query(
      'DELETE FROM events WHERE user_id=$1 AND id IN (SELECT id FROM events WHERE user_id=$1 ORDER BY created_at DESC OFFSET 200)',
      [uid],
    );
    return id;
  }
  async function readEvents(uid: string): Promise<AppNotification[]> {
    const { rows } = await db.query<EventRow>(
      'SELECT id,kind,ciphertext,created_at,read_at FROM events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 200',
      [uid],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      ...decrypt<EventContent>(r.ciphertext, config.encryptionKey),
      createdAt: iso(r.created_at)!,
      readAt: iso(r.read_at),
    }));
  }
  async function readConnection(uid: string): Promise<ConnectionState> {
    const { rows } = await db.query<{
      status: ConnectionState['status'];
      last_handoff_at: Date | null;
      confirmed_at: Date | null;
    }>('SELECT status,last_handoff_at,confirmed_at FROM integration_state WHERE user_id=$1', [uid]);
    const r = rows[0];
    return r
      ? {
          ...initialConnection,
          status: r.status,
          lastHandoffAt: iso(r.last_handoff_at),
          confirmedAt: iso(r.confirmed_at),
        }
      : { ...initialConnection };
  }
  const dummyHash = await hashPassword(newToken());
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      version: APP_VERSION,
      database: db.kind,
      development: !config.production,
    });
  });
  app.get('/api/auth/session', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      res.json({ user: null });
      return;
    }
    const { rows } = await db.query<{ id: string; email: string; displayName: string }>(
      'SELECT u.id,u.email,u.display_name AS "displayName" FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND s.last_seen_at>now()-interval \'1 day\'',
      [hashToken(token)],
    );
    res.json({ user: rows[0] ?? null });
  });
  const registrationLimiter = rateLimit({
    windowMs: 60 * 60000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.rateLimitDisabled,
    message: {
      error: 'Too many companion accounts created from this network. Try again later.',
      code: 'RATE_LIMITED',
    },
  });
  app.post('/api/auth/register', registrationLimiter, authLimiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(input.password);
    const id = randomUUID();
    try {
      await db.transaction(async (tx) => {
        await tx.query(
          'INSERT INTO users(id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)',
          [id, input.email, input.displayName, passwordHash],
        );
        await tx.query('INSERT INTO preferences(user_id,ciphertext) VALUES ($1,$2)', [
          id,
          encrypt(defaultSettings, config.encryptionKey),
        ]);
        await tx.query('INSERT INTO integration_state(user_id) VALUES ($1)', [id]);
        await addEvent(tx, id, 'welcome', {
          title: 'Your workspace is ready',
          body: 'Organize your contacts and preferences here. Your Snapchat conversations stay on Snapchat.',
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        res.status(409).json({
          error: 'Unable to create this account. Try signing in instead.',
          code: 'REGISTRATION_UNAVAILABLE',
        });
        return;
      }
      throw error;
    }
    await createSession(db, config, id, res);
    res.status(201).json({ user: { id, email: input.email, displayName: input.displayName } });
  });
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    const input = credentialsSchema.parse(req.body);
    const { rows } = await db.query<{
      id: string;
      email: string;
      displayName: string;
      password_hash: string;
    }>('SELECT id,email,display_name AS "displayName",password_hash FROM users WHERE email=$1', [
      input.email,
    ]);
    const user = rows[0];
    const valid = await verifyPassword(input.password, user?.password_hash ?? dummyHash);
    if (!user || !valid) {
      res
        .status(401)
        .json({ error: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' });
      return;
    }
    await createSession(db, config, user.id, res);
    res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
  });
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') {
      const hash = hashToken(token);
      const { rows } = await db.query<{ user_id: string }>(
        'SELECT user_id FROM sessions WHERE token_hash=$1',
        [hash],
      );
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [hash]);
      if (rows[0])
        sync?.broadcast(rows[0].user_id, { type: 'session-revoked', source: source(req) });
    }
    res.clearCookie(SESSION_COOKIE, sessionCookie(config));
    res.json({ ok: true });
  });
  app.get('/api/integrations', (_req, res) =>
    res.json({
      providers: [
        {
          id: 'official-web',
          name: 'Snapchat Web',
          capabilities: officialWebCapabilities,
          officialUrl: OFFICIAL_SNAPCHAT_WEB,
        },
      ],
      limitation:
        'Opening Snapchat Web does not verify a session or grant access to private messages.',
    }),
  );
  app.use('/api', authMiddleware(db, config));
  app.get('/api/bootstrap', async (req, res) => {
    const uid = userId(req);
    const [p, c] = await Promise.all([
      db.query<{ ciphertext: string; revision: number }>(
        'SELECT ciphertext,revision FROM preferences WHERE user_id=$1',
        [uid],
      ),
      db.query<ContactRow>(
        'SELECT id,ciphertext,created_at,updated_at FROM contacts WHERE user_id=$1 ORDER BY created_at DESC',
        [uid],
      ),
    ]);
    const data: WorkspaceData = {
      user: req.auth!.user,
      settings: p.rows[0]
        ? decrypt<Settings>(p.rows[0].ciphertext, config.encryptionKey)
        : structuredClone(defaultSettings),
      revision: p.rows[0]?.revision ?? 1,
      contacts: c.rows.map(
        (r) =>
          ({
            id: r.id,
            ...decrypt<object>(r.ciphertext, config.encryptionKey),
            createdAt: iso(r.created_at)!,
            updatedAt: iso(r.updated_at)!,
          }) as Contact,
      ),
      notifications: await readEvents(uid),
      connection: await readConnection(uid),
    };
    res.json(data);
  });
  app.put('/api/settings', async (req, res) => {
    const input = z
      .object({ settings: settingsSchema, revision: z.number().int().positive() })
      .strict()
      .parse(req.body);
    const result = await db.transaction(async (tx) => {
      const updated = await tx.query<{ revision: number }>(
        'UPDATE preferences SET ciphertext=$1,revision=revision+1,updated_at=now() WHERE user_id=$2 AND revision=$3 RETURNING revision',
        [encrypt(input.settings, config.encryptionKey), userId(req), input.revision],
      );
      if (!updated.rows[0]) return null;
      const contacts = await tx.query<ContactRow>(
        'SELECT id,ciphertext,created_at,updated_at FROM contacts WHERE user_id=$1',
        [userId(req)],
      );
      let contactsChanged = false;
      const validIds = new Set(input.settings.labels.map((label) => label.id));
      for (const row of contacts.rows) {
        const contact = decrypt<{ labelIds: string[] }>(row.ciphertext, config.encryptionKey);
        const labelIds = contact.labelIds.filter((id) => validIds.has(id));
        if (labelIds.length !== contact.labelIds.length) {
          await tx.query(
            'UPDATE contacts SET ciphertext=$1,updated_at=now() WHERE id=$2 AND user_id=$3',
            [encrypt({ ...contact, labelIds }, config.encryptionKey), row.id, userId(req)],
          );
          contactsChanged = true;
        }
      }
      return { revision: updated.rows[0].revision, contactsChanged };
    });
    if (!result) {
      const current = await db.query<{ ciphertext: string; revision: number }>(
        'SELECT ciphertext,revision FROM preferences WHERE user_id=$1',
        [userId(req)],
      );
      res.status(409).json({
        error: 'Settings changed on another device. The latest version has been loaded.',
        code: 'REVISION_CONFLICT',
        settings: current.rows[0]
          ? decrypt(current.rows[0].ciphertext, config.encryptionKey)
          : defaultSettings,
        revision: current.rows[0]?.revision ?? 1,
      });
      return;
    }
    emit(req, 'settings', result.revision);
    if (result.contactsChanged) emit(req, 'contacts');
    res.json({ revision: result.revision, settings: input.settings });
  });
  app.post('/api/contacts', async (req, res) => {
    const input = contactInputSchema.parse(req.body);
    const settings = await db.query<{ ciphertext: string }>(
      'SELECT ciphertext FROM preferences WHERE user_id=$1',
      [userId(req)],
    );
    const labels = settings.rows[0]
      ? decrypt<Settings>(settings.rows[0].ciphertext, config.encryptionKey).labels
      : [];
    if (input.labelIds.some((id) => !labels.some((l) => l.id === id))) {
      res.status(400).json({ error: 'Choose an existing label.', code: 'INVALID_LABEL' });
      return;
    }
    const id = randomUUID();
    const count = await db.query<{ total: string }>(
      'SELECT count(*) AS total FROM contacts WHERE user_id=$1',
      [userId(req)],
    );
    if (Number(count.rows[0]?.total ?? 0) >= 1000) {
      res.status(409).json({
        error:
          'This workspace supports up to 1,000 local contacts. Remove a contact before adding another.',
        code: 'CONTACT_LIMIT',
      });
      return;
    }
    const contact = await db.transaction(async (tx) => {
      const r = await tx.query<ContactRow>(
        'INSERT INTO contacts(id,user_id,ciphertext) VALUES ($1,$2,$3) RETURNING id,ciphertext,created_at,updated_at',
        [id, userId(req), encrypt(input, config.encryptionKey)],
      );
      await addEvent(tx, userId(req), 'contact', {
        title: 'Contact added to your workspace',
        body: 'A locally maintained contact is now available on your signed-in devices.',
      });
      const row = r.rows[0]!;
      return {
        id: row.id,
        ...input,
        createdAt: iso(row.created_at)!,
        updatedAt: iso(row.updated_at)!,
      };
    });
    emit(req, 'contacts');
    emit(req, 'notifications');
    res.status(201).json(contact);
  });
  app.patch('/api/contacts/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const input = contactInputSchema.parse(req.body);
    const p = await db.query<{ ciphertext: string }>(
      'SELECT ciphertext FROM preferences WHERE user_id=$1',
      [userId(req)],
    );
    const labels = p.rows[0]
      ? decrypt<Settings>(p.rows[0].ciphertext, config.encryptionKey).labels
      : [];
    if (input.labelIds.some((id) => !labels.some((l) => l.id === id))) {
      res.status(400).json({ error: 'Choose an existing label.', code: 'INVALID_LABEL' });
      return;
    }
    const r = await db.query<ContactRow>(
      'UPDATE contacts SET ciphertext=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,ciphertext,created_at,updated_at',
      [encrypt(input, config.encryptionKey), id, userId(req)],
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: 'Contact not found.', code: 'NOT_FOUND' });
      return;
    }
    emit(req, 'contacts');
    const row = r.rows[0];
    res.json({
      id: row.id,
      ...input,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
    });
  });
  app.delete('/api/contacts/:id', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const r = await db.query('DELETE FROM contacts WHERE id=$1 AND user_id=$2', [id, userId(req)]);
    if (!r.rowCount) {
      res.status(404).json({ error: 'Contact not found.', code: 'NOT_FOUND' });
      return;
    }
    emit(req, 'contacts');
    res.json({ ok: true });
  });
  app.post('/api/integrations/snapchat/handoff', async (req, res) => {
    const input = z
      .object({ purpose: z.enum(['login', 'register']) })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx.query(
        "UPDATE integration_state SET status='handoff_opened',last_handoff_at=now(),confirmed_at=NULL WHERE user_id=$1",
        [userId(req)],
      );
      await addEvent(tx, userId(req), 'handoff', {
        title:
          input.purpose === 'register' ? 'Snapchat registration opened' : 'Snapchat Web opened',
        body: 'Continue in Snapchat’s official interface. SnapRun cannot verify your login or read your messages.',
      });
    });
    emit(req, 'connection');
    emit(req, 'notifications');
    res.json({ url: OFFICIAL_SNAPCHAT_WEB, connection: await readConnection(userId(req)) });
  });
  app.put('/api/integrations/snapchat/status', async (req, res) => {
    const input = z
      .object({ status: z.enum(['not_connected', 'user_confirmed']) })
      .strict()
      .parse(req.body);
    await db.transaction(async (tx) => {
      await tx.query('UPDATE integration_state SET status=$1,confirmed_at=$2 WHERE user_id=$3', [
        input.status,
        input.status === 'user_confirmed' ? new Date() : null,
        userId(req),
      ]);
      await addEvent(tx, userId(req), 'connection', {
        title:
          input.status === 'user_confirmed' ? 'Connection note updated' : 'Connection note cleared',
        body:
          input.status === 'user_confirmed'
            ? 'You marked Snapchat as signed in. This is self-reported, not verified by SnapRun.'
            : 'Your workspace no longer marks Snapchat as signed in.',
      });
    });
    emit(req, 'connection');
    emit(req, 'notifications');
    res.json({ connection: await readConnection(userId(req)) });
  });
  app.get('/api/notifications', async (req, res) => res.json(await readEvents(userId(req))));
  app.patch('/api/notifications/:id/read', async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const r = await db.query(
      'UPDATE events SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2',
      [id, userId(req)],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: 'Notification not found.', code: 'NOT_FOUND' });
      return;
    }
    emit(req, 'notifications');
    res.json({ ok: true });
  });
  app.post('/api/notifications/read-all', async (req, res) => {
    await db.query('UPDATE events SET read_at=now() WHERE user_id=$1 AND read_at IS NULL', [
      userId(req),
    ]);
    emit(req, 'notifications');
    res.json({ ok: true });
  });
  app.delete('/api/notifications', async (req, res) => {
    await db.query('DELETE FROM events WHERE user_id=$1', [userId(req)]);
    emit(req, 'notifications');
    res.json({ ok: true });
  });
  app.get('/api/account/export', async (req, res) => {
    const uid = userId(req);
    const [p, c] = await Promise.all([
      db.query<{ ciphertext: string; revision: number }>(
        'SELECT ciphertext,revision FROM preferences WHERE user_id=$1',
        [uid],
      ),
      db.query<ContactRow>(
        'SELECT id,ciphertext,created_at,updated_at FROM contacts WHERE user_id=$1',
        [uid],
      ),
    ]);
    res.setHeader('Content-Disposition', 'attachment; filename="snaprun-export.json"');
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      user: req.auth!.user,
      settings: p.rows[0] ? decrypt(p.rows[0].ciphertext, config.encryptionKey) : defaultSettings,
      contacts: c.rows.map((r) => ({
        id: r.id,
        ...decrypt<object>(r.ciphertext, config.encryptionKey),
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
      })),
      notifications: await readEvents(uid),
      connection: await readConnection(uid),
      excludes:
        'Passwords, session tokens, Snapchat credentials and Snapchat messages are never included.',
    });
  });
  app.delete('/api/account', async (req, res) => {
    const input = z
      .object({ password: z.string().min(1).max(128), confirmation: z.literal('DELETE') })
      .strict()
      .parse(req.body);
    const r = await db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id=$1',
      [userId(req)],
    );
    if (!r.rows[0] || !(await verifyPassword(input.password, r.rows[0].password_hash))) {
      res
        .status(403)
        .json({ error: 'Your companion account password is incorrect.', code: 'INVALID_PASSWORD' });
      return;
    }
    const uid = userId(req);
    await db.query('DELETE FROM users WHERE id=$1', [uid]);
    sync?.closeSessions(uid, source(req));
    res.clearCookie(SESSION_COOKIE, sessionCookie(config));
    res.json({ ok: true });
  });
  app.use('/api', (_req, res) =>
    res.status(404).json({ error: 'Endpoint not found.', code: 'NOT_FOUND' }),
  );
  if (config.serveWeb) {
    app.use(express.static(resolve(rootDir, 'apps/web/dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(rootDir, 'apps/web/dist/index.html')));
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues[0]?.message ?? 'Invalid request.',
        code: 'VALIDATION_ERROR',
        fields: error.issues.map((i) => i.path.join('.')),
      });
      return;
    }
    if ((error as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body.', code: 'INVALID_JSON' });
      return;
    }
    if ((error as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'Request is too large.', code: 'PAYLOAD_TOO_LARGE' });
      return;
    }
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({
      error: 'The service is temporarily unavailable. Please try again.',
      code: 'INTERNAL_ERROR',
    });
  });
  return app;
}
