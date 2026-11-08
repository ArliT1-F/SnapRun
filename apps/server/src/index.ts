import { createServer } from 'node:http';
import { loadConfig } from './config';
import { createDatabase } from './db';
import { migrate } from './migrate';
import { createApp } from './app';
import { attachSync } from './sync';
const config = loadConfig();
const db = await createDatabase(config);
try {
  if (!config.production) await migrate(db);
  const app = await createApp(db, config);
  const server = createServer(app);
  const sync = attachSync(server, db, config);
  await new Promise<void>((resolve) => server.listen(config.port, '0.0.0.0', resolve));
  console.log(
    `SnapRun API listening on port ${config.port} (${db.kind}${config.production ? '' : ', development only'})`,
  );
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await sync.close();
    server.close();
    await db.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
} catch (error) {
  await db.close();
  console.error('Startup failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
}
