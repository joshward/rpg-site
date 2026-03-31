import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { config } from '@/lib/config';

declare global {
  // eslint-disable-next-line no-var
  var dbPool: Pool | undefined;
}

const pool = globalThis.dbPool ?? new Pool({ connectionString: config.databaseUrl });

if (process.env.NODE_ENV !== 'production') {
  globalThis.dbPool = pool;
}

export const db = drizzle({ client: pool, casing: 'snake_case' });
