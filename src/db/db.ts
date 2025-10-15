import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from '@/lib/config';

const sql = neon(config.databaseUrl);
export const db = drizzle({ client: sql, casing: 'snake_case' });
