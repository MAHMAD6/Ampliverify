// Creates or updates the Better Auth tables in AUTH_DATABASE_URL, using the
// app's own auth options (src/lib/auth.ts), so the schema always matches the
// enabled plugins. Usage: npm run auth:migrate [-- --dry-run]
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createJiti } from 'jiti';

config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) });
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
if (!process.env.AUTH_DATABASE_URL) {
  console.error('AUTH_DATABASE_URL is not set.');
  process.exit(1);
}

const jiti = createJiti(import.meta.url, {
  alias: {
    '@': fileURLToPath(new URL('../src', import.meta.url)),
    // `server-only` throws outside the Next.js server bundle.
    'server-only': fileURLToPath(new URL('./empty-module.mjs', import.meta.url)),
  },
});
const { authOptions } = await jiti.import('../src/lib/auth.ts');
const { getMigrations } = await import('better-auth/db/migration');

const { toBeCreated, toBeAdded, runMigrations, compileMigrations } = await getMigrations(authOptions);
if (!toBeCreated.length && !toBeAdded.length) {
  console.log('Better Auth schema is up to date.');
} else if (process.argv.includes('--dry-run')) {
  console.log(await compileMigrations());
} else {
  await runMigrations();
  console.log(`Better Auth schema migrated: ${toBeCreated.map((t) => t.table).join(', ') || 'columns added'}.`);
}
await authOptions.database.end();
