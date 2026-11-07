import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { Database } from './db';
import { hashToken } from './security';
import { SESSION_COOKIE } from './auth';
import type { Config } from './config';
import type { SyncMessage } from '@snaprun/shared';
import { idSchema } from './auth';
export function attachSync(server: Server, db: Database, config: Config) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const clients = new Map<
    WebSocket,
    { userId: string; tokenHash: string; source: string; alive: boolean }
  >();
  const originAllowed = (origin: string | undefined, host: string | undefined) =>
    !!origin &&
    (config.allowedOrigins.includes(origin) ||
      (!config.production &&
        (() => {
          try {
            return new URL(origin).host === host;
          } catch {
            return false;
          }
        })()));
  server.on('upgrade', async (req, socket, head) => {
    if (req.url !== '/api/sync') return;
    try {
      if (!originAllowed(req.headers.origin, req.headers.host)) throw new Error('Origin rejected');
      const cookie = req.headers.cookie
        ?.split(';')
        .map((x) => x.trim())
        .find((x) => x.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
      if (!cookie || !/^[A-Za-z0-9_-]{43}$/.test(cookie)) throw new Error('Unauthenticated');
      const tokenHash = hashToken(cookie);
      const { rows } = await db.query<{ user_id: string }>(
        "SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at > now() AND last_seen_at > now() - interval '1 day'",
        [tokenHash],
      );
      const userId = rows[0]?.user_id;
      if (!userId || [...clients.values()].filter((c) => c.userId === userId).length >= 5)
        throw new Error('Connection limit');
      wss.handleUpgrade(req, socket, head, (ws) => {
        clients.set(ws, { userId, tokenHash, source: randomUUID(), alive: true });
        ws.send(JSON.stringify({ type: 'ready', source: clients.get(ws)!.source }));
        ws.on('pong', () => {
          const c = clients.get(ws);
          if (c) c.alive = true;
        });
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(String(data));
            if (message.type === 'hello' && idSchema.safeParse(message.clientId).success) {
              const c = clients.get(ws);
              if (c) c.source = message.clientId;
            }
          } catch {
            /* Client hints are optional and never authoritative. */
          }
        });
        ws.on('error', () => ws.close());
        ws.on('close', () => clients.delete(ws));
      });
    } catch {
      if (!socket.destroyed) socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });
  const timer = setInterval(() => {
    for (const [ws, client] of clients) {
      void db
        .query(
          "SELECT 1 FROM sessions WHERE token_hash=$1 AND expires_at > now() AND last_seen_at > now() - interval '1 day'",
          [client.tokenHash],
        )
        .then((r) => {
          if (!r.rowCount || !client.alive) {
            ws.close(1008, 'Session expired');
            return;
          }
          client.alive = false;
          ws.ping();
        })
        .catch(() => ws.close(1011, 'Database unavailable'));
    }
  }, 30000);
  timer.unref();
  wss.on('close', () => clearInterval(timer));
  return {
    broadcast(userId: string, message: SyncMessage) {
      for (const [ws, c] of clients)
        if (c.userId === userId && ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify(message));
    },
    closeSessions(userId: string, exceptSource?: string) {
      for (const [ws, c] of clients)
        if (c.userId === userId && c.source !== exceptSource) ws.close(1008, 'Session revoked');
    },
    async close() {
      clearInterval(timer);
      for (const ws of clients.keys()) ws.terminate();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
export type SyncHub = ReturnType<typeof attachSync>;
