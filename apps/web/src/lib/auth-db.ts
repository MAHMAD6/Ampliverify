import 'server-only';
import { Pool } from 'pg';

const globalForPool = globalThis as unknown as { authPool?: Pool };

/** One connection pool to the auth server's database (Better Auth tables), shared across hot reloads. */
export const authPool = globalForPool.authPool ?? new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForPool.authPool = authPool;
