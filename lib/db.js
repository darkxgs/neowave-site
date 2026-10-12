import pg from 'pg';

// One small pool per function instance. DATABASE_URL is the restricted `pcg_app` role (schema pcg only).
let pool;
export function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not configured');
    pool = new pg.Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 10_000 });
  }
  return pool;
}

export async function query(text, params) {
  const { rows } = await getPool().query(text, params);
  return rows;
}

export async function one(text, params) {
  return (await query(text, params))[0] || null;
}

// Runs fn(client) inside a transaction; rolls back on any error.
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const out = await fn({
      query: async (t, p) => (await client.query(t, p)).rows,
      one: async (t, p) => (await client.query(t, p)).rows[0] || null,
    });
    await client.query('commit');
    return out;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
