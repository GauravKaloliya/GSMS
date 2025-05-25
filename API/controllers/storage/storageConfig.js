require('dotenv').config();

module.exports = {
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE_BYTES) || 100 * 1024 * 1024,
  TEMP_UPLOAD_DIR: process.env.TEMP_UPLOAD_DIR,
  FINAL_UPLOAD_DIR: process.env.FINAL_UPLOAD_DIR,
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_VERSION_RETRIES: 3,
  INITIAL_BACKOFF_MS: 100,
  VIRUS_SCAN_STRICT: process.env.VIRUS_SCAN_STRICT === 'true'
};
