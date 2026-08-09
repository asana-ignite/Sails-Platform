import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production' && connectionString && !connectionString.includes('pgbouncer=true')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}pgbouncer=true&connection_limit=20`;
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

pool.on('error', (err) => {
  console.error('[knex] Unexpected pool error:', err);
});

export { pool };
