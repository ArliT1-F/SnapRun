import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type { Config } from './config';
import type { Database } from './db';
import { hashToken, newToken } from './security';
import type { User } from '@snaprun/shared';
export type Auth = { user: User; tokenHash: string; expiresAt: Date };
declare global {
  namespace Express {
    interface Request {
      auth?: Auth;
    }
  }
}
export const SESSION_COOKIE = 'snaprun_session';
export function sessionCookie(config: Config) {
  return {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax' as const,
    path: '/api',
    maxAge: config.sessionDays * 86400000,
  };
}
export async function createSession(db: Database, config: Config, userId: string, res: Response) {
  const token = newToken();
  const expires = new Date(Date.now() + config.sessionDays * 86400000);
  await db.query('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [
    hashToken(token),
    userId,
    expires,
  ]);
  res.cookie(SESSION_COOKIE, token, sessionCookie(config));
}
export function authMiddleware(db: Database, config: Config) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      res.status(401).json({ error: 'Sign in to continue.', code: 'UNAUTHENTICATED' });
      return;
    }
    const tokenHash = hashToken(token);
    const { rows } = await db.query<User & { expires_at: Date; last_seen_at: Date }>(
      'SELECT u.id,u.email,u.display_name AS "displayName",s.expires_at,s.last_seen_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now()',
      [tokenHash],
    );
    const row = rows[0];
    if (!row || Date.now() - new Date(row.last_seen_at).getTime() > 86400000) {
      await db.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash]);
      res.clearCookie(SESSION_COOKIE, sessionCookie(config));
      res
        .status(401)
        .json({ error: 'Your session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
      return;
    }
    req.auth = {
      user: { id: row.id, email: row.email, displayName: row.displayName },
      tokenHash,
      expiresAt: new Date(row.expires_at),
    };
    if (Date.now() - new Date(row.last_seen_at).getTime() > 300000)
      await db.query('UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1', [tokenHash]);
    next();
  };
}
export const idSchema = z.string().uuid();
