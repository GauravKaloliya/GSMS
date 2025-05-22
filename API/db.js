const { Pool } = require('pg');
const AWS = require('aws-sdk');

const pool = new Pool({
  connectionString: process.env.POSTGRES_PRISMA_URL, // use your full Neon URL here
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: {
    rejectUnauthorized: false // Neon requires this for SSL in node
  }
});

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

const s3 = new AWS.S3();

async function setEncryptionKey(client) {
  const key = process.env.PG_ENCRYPT_KEY;
  if (!key) throw new Error('Encryption key must be provided');
  await client.query('SET pg.encrypt_key = $1', [key]);
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(1);
});

// Helper function to query with encryption key set on connection
async function query(text, params) {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    const res = await client.query(text, params);
    return res;
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