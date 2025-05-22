const { pool, setEncryptionKey } = require('../../db');

const runWithClient = async (handler) => {
  const client = await pool.connect();
  try {
    await setEncryptionKey(client);
    return await handler(client);
  } finally {
    client.release();
  }
};

const registerUser = async (req, res) => {
  try {
    const { user_id } = await runWithClient(async (client) => {
      const result = await client.query(`
        INSERT INTO user_identity DEFAULT VALUES
        RETURNING user_id
      `);
      return result.rows[0];
    });

    res.status(201).json({ user_id });
  } catch (e) {
    console.error('Error in registerUser:', e);
    res.status(500).json({ error: 'User creation failed' });
  }
};

module.exports = { registerUser };