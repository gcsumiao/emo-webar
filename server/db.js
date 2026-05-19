import pg from 'pg';

const { Pool } = pg;

export const DEFAULT_DATABASE_URL = 'postgres://emo:emo@127.0.0.1:5432/emo_ar';

let pool = null;
let poolConnectionString = '';

function parseDatabaseUrl(connectionString) {
  try {
    return new URL(connectionString);
  } catch {
    return null;
  }
}

function shouldUseSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return true;

  const parsed = parseDatabaseUrl(connectionString);
  if (!parsed) return false;
  const sslMode = parsed.searchParams.get('sslmode');
  if (sslMode === 'disable') return false;
  if (sslMode) return true;
  return /(^|\.)neon\.tech$/i.test(parsed.hostname);
}

export function getDatabaseUrl({ allowDefault = false } = {}) {
  return process.env.DATABASE_URL || (allowDefault ? DEFAULT_DATABASE_URL : '');
}

export function getPool({ allowDefault = false } = {}) {
  const connectionString = getDatabaseUrl({ allowDefault });
  if (!connectionString) return null;

  if (!pool || poolConnectionString !== connectionString) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.PGPOOL_MAX || 4),
      idleTimeoutMillis: 10_000,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    });
    poolConnectionString = connectionString;
  }

  return pool;
}

export async function withDb(callback, { allowDefault = false } = {}) {
  const db = getPool({ allowDefault });
  if (!db) return null;

  const client = await db.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
  poolConnectionString = '';
}
