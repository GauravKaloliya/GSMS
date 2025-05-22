const { Pool } = require('pg');
const AWS = require('aws-sdk');

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL, // Neon or other Postgres URL
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false, // required for Neon SSL
  },
});

// Configure AWS SDK with credentials and region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

const s3 = new AWS.S3();

/**
 * Set the PostgreSQL encryption key for pgcrypto operations.
 * Must be called per connection before any encryption-related queries.
 * @param {import('pg').PoolClient} client
 */
async function setEncryptionKey(client) {
  const key = process.env.PG_ENCRYPT_KEY;
  if (!key) throw new Error('Encryption key must be provided');
  await client.query('SET pg.encrypt_key = $1', [key]);
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(1);
});

/**
 * Helper query function that automatically sets encryption key on connection.
 * @param {string} text SQL query text
 * @param {Array} params Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  s3,
  setEncryptionKey,
};