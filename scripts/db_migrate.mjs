import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, withDb } from '../server/db.js';

const migrationsDir = path.join(process.cwd(), 'db', 'migrations');

async function main() {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log('No migrations found.');
    return;
  }

  await withDb(async (client) => {
    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`Applied ${file}`);
    }
  }, { allowDefault: true });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
