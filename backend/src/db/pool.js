const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || '';
const isRenderDb =
  /render\.com/i.test(connectionString) || String(process.env.NODE_ENV).toLowerCase() === 'production';

const pool = new Pool({
  connectionString,
  ...(isRenderDb ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL client error', err);
});

module.exports = pool;
