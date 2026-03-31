import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { config } from '@/lib/config';

const pool = new Pool({ connectionString: config.databaseUrl });
export const db = drizzle({ client: pool, casing: 'snake_case' });
