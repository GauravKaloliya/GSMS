require('dotenv').config();
const { Pool } = require('pg');
const AWS = require('aws-sdk');

// ---- PostgreSQL Pool Setup ----
const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected PG client error', err);
  process.exit(1);
});

// ---- AWS S3 Setup ----
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();

// ---- Encryption Key Handling ----
function getEncryptionKey() {
  const key = process.env.PG_ENCRYPT_KEY;
  if (!key) throw new Error('PG_ENCRYPT_KEY environment variable is required');
  return key;
}

async function setEncryptionKey(client) {
  const key = getEncryptionKey();
  // Use parameterized query to avoid SQL injection
  await client.query(`SET pg.encrypt_key = $1`, [key]);
}

// ---- Query Helpers ----
async function query(text, params = []) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

async function runWithTransaction(callback) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    await client.query('BEGIN');

    // Pass raw client with encryption already set
    const q = (text, params = []) => client.query(text, params);
    const result = await callback(q, client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Error in runWithTransaction:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  s3,
  query,
  runWithTransaction,
  getEncryptionKey,
};