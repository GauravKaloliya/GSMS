const { Pool } = require('pg');
const AWS = require('aws-sdk');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + '?sslmode=require',
  max: 20,                    
  idleTimeoutMillis: 30000,   
  connectionTimeoutMillis: 2000, 
});

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
});

const s3 = new AWS.S3();

async function setEncryptionKey(client, key) {
  if (!key) throw new Error('Encryption key must be provided');
  await client.query('SET pg.encrypt_key = $1', [key]);
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(1);
});

module.exports = {
  pool,
  s3,
  setEncryptionKey,
};