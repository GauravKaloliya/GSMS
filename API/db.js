require('dotenv').config();
const { Pool } = require('pg');
const AWS = require('aws-sdk');

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();

async function setEncryptionKey(client) {
  const key = process.env.PG_ENCRYPT_KEY;
  if (!key) throw new Error('PG_ENCRYPT_KEY environment variable is required');
  await client.query('SET pg.encrypt_key = $1', [key]);
}

async function query(text, params = []) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function runWithTransaction(callback) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    await client.query('BEGIN');
    const q = (text, params = []) => client.query(text, params);
    const result = await callback(q, client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
  runWithTransaction,
  s3,
};