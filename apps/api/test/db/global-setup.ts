import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/** Minimal .env reader so tests work without exporting variables by hand. */
function loadDotEnv() {
  try {
    for (const line of readFileSync(join(__dirname, '..', '..', '.env'), 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
    }
  } catch {
    // no .env — rely on the real environment
  }
}

/**
 * Rebuilds the test database from the committed migrations. Refuses to run
 * against anything that does not look like a dedicated test database.
 */
export default async function globalSetup() {
  loadDotEnv();
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for `npm run test:db` (see .env.example).');
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName) || url === process.env.DATABASE_URL) {
    throw new Error(`Refusing to reset "${dbName}": TEST_DATABASE_URL must name a dedicated *test* database.`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.end();

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
