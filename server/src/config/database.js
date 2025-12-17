const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'classifarr',
  user: process.env.POSTGRES_USER || 'classifarr',
  password: process.env.POSTGRES_PASSWORD || 'classifarr_secret',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✓ Database connected successfully');
    client.release();
    return true;
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    throw err;
  }
}

// Query helper
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed:', { text: text.substring(0, 50), duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Query error:', err.message);
    throw err;
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
