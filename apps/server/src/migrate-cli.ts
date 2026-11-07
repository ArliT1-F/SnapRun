import { createDatabase } from './db';
import { loadConfig } from './config';
import { migrate } from './migrate';
const db = await createDatabase(loadConfig());
try {
  await migrate(db);
  console.log('Database migrations are up to date.');
} finally {
  await db.close();
}
