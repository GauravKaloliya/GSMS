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

async function getEncryptionKey() {
  const key = process.env.PG_ENCRYPT_KEY;
  if (!key) throw new Error('PG_ENCRYPT_KEY environment variable is required');
  return key;
}

async function setEncryptionKey(client) {
  const key = await getEncryptionKey();
  await client.query(`SET pg.encrypt_key = '${key.replace(/'/g, "''")}'`);
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
  try {
    await setEncryptionKey(client);

    await query('BEGIN');
    const q = (text, params = []) => query(text, params);
    const result = await callback(q, client);
    await query('COMMIT');

    return result;
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    console.error('Error in runWithTransaction:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  getEncryptionKey,
  query,
  runWithTransaction,
  s3,
};