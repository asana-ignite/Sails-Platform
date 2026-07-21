import { Pool } from 'pg';

let connectionString = process.env.DATABASE_URL;
if (process.env.NODE_ENV === 'production' && connectionString && !connectionString.includes('pgbouncer=true')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}pgbouncer=true&connection_limit=20`;
}

const pool = new Pool({
  connectionString,
});

export { pool };
