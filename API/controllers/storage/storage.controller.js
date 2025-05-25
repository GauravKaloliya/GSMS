const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const crypto = require('crypto');
const sanitize = require('sanitize-filename');
const NodeClam = require('clamscan');
const winston = require('winston');
const config = require('./storageConfig');

// === Logger setup ===
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// === Multer setup ===
const upload = multer({
  dest: config.TEMP_UPLOAD_DIR,
  limits: { fileSize: config.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (config.ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Unsupported file type'));
  },
});

// === Utility functions ===
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

function sanitizeFilename(filename) {
  return sanitize(filename).replace(/\s+/g, '_') || 'unnamed_file';
}

async function calculateFileHash(filepath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fsSync.createReadStream(filepath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// === ClamAV Initialization ===
let clamScanInstance = null;
async function initClamScan() {
  try {
    clamScanInstance = await new NodeClam().init();
    logger.info('ClamAV initialized');
  } catch (err) {
    logger.error('Failed to initialize ClamAV: %o', err);
  }
}
initClamScan();

// === Virus scan wrapper ===
async function virusScan(filepath) {
  if (!clamScanInstance) {
    const msg = 'ClamAV not initialized';
    if (config.VIRUS_SCAN_STRICT) {
      logger.error(msg);
      throw new Error('Virus scanning service unavailable');
    } else {
      logger.warn(msg + '; skipping virus scan');
      return true;
    }
  }
  const { isInfected } = await clamScanInstance.isInfected(filepath);
  return !isInfected;
}

// === Main upload router factory ===
// Accept dependencies for testability (dbQueryFn, clamScanInstance)
function createUploadRouter({ runWithTransaction, verifyToken, dbQueryFn = null }) {
  const router = express.Router();

  router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
    const userId = req.user.uid;
    const { folder_id, file_id } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!folder_id) {
      await fs.unlink(file.path).catch(() => {});
      return res.status(400).json({ error: 'Target folder_id is required.' });
    }

    try {
      // Check folder ownership
      const ownsFolder = await runWithTransaction(async (query) => {
        const { rowCount } = await query(
          `SELECT 1 FROM folder_owner WHERE folder_id = $1 AND user_id = $2 AND valid_to IS NULL LIMIT 1`,
          [folder_id, userId]
        );
        return rowCount > 0;
      });

      if (!ownsFolder) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(403).json({ error: 'You do not own the target folder.' });
      }

      // Virus scan
      const scanResult = await virusScan(file.path);
      if (!scanResult) {
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({ error: 'File failed virus scan.' });
      }

      // Check file ownership if updating existing file
      let newFileId = file_id;
      if (file_id) {
        const ownsFile = await runWithTransaction(async (query) => {
          const { rowCount } = await query(
            `SELECT 1 FROM file_owner fo
             JOIN file_parent_folder fpf ON fo.file_id = fpf.file_id
             WHERE fo.file_id = $1 AND fo.user_id = $2
             AND fpf.parent_folder_id = $3
             AND fo.valid_to IS NULL AND fpf.valid_to IS NULL
             LIMIT 1`,
            [file_id, userId, folder_id]
          );
          return rowCount > 0;
        });

        if (!ownsFile) {
          await fs.unlink(file.path).catch(() => {});
          return res.status(403).json({ error: 'You do not own this file or it is not in the folder.' });
        }
      }

      const fileHash = await calculateFileHash(file.path);

      let versionId, versionNumber;
      let attempts = 0;

      while (attempts < config.MAX_VERSION_RETRIES) {
        try {
          await runWithTransaction(async (query) => {
            // Optional: Use advisory lock for concurrency control here
            // await query(`SELECT pg_advisory_xact_lock($1)`, [newFileId]);

            if (!newFileId) {
              const insertFileRes = await query(`INSERT INTO file_identity DEFAULT VALUES RETURNING file_id`);
              newFileId = insertFileRes.rows[0].file_id;

              await query(`INSERT INTO file_owner(file_id, user_id) VALUES ($1, $2)`, [newFileId, userId]);
              await query(`INSERT INTO file_parent_folder(file_id, parent_folder_id) VALUES ($1, $2)`, [newFileId, folder_id]);
              await query(`INSERT INTO file_creation(file_id) VALUES ($1)`, [newFileId]);
            }

            await query(`UPDATE file_name SET valid_to = NOW() WHERE file_id = $1 AND valid_to IS NULL`, [newFileId]);
            await query(`INSERT INTO file_name(file_id, file_name) VALUES ($1, $2)`, [newFileId, file.originalname]);

            await query(`UPDATE file_size SET valid_to = NOW() WHERE file_id = $1 AND valid_to IS NULL`, [newFileId]);
            await query(`INSERT INTO file_size(file_id, file_size) VALUES ($1, $2)`, [newFileId, file.size]);

            const insertVersionRes = await query(`INSERT INTO file_version_identity DEFAULT VALUES RETURNING version_id`);
            versionId = insertVersionRes.rows[0].version_id;

            await query(`INSERT INTO file_version_file(version_id, file_id) VALUES ($1, $2)`, [versionId, newFileId]);

            const maxVersionRes = await query(
              `SELECT MAX(fvn.version_number) AS max_version
               FROM file_version_file fvf
               JOIN file_version_number fvn ON fvf.version_id = fvn.version_id
               WHERE fvf.file_id = $1 AND fvn.valid_to IS NULL FOR UPDATE`,
              [newFileId]
            );
            versionNumber = (maxVersionRes.rows[0].max_version ?? 0) + 1;

            await query(`INSERT INTO file_version_number(version_id, version_number) VALUES ($1, $2)`, [versionId, versionNumber]);
            await query(`INSERT INTO file_version_hash(version_id, hash) VALUES ($1, $2)`, [versionId, fileHash]);
            await query(`INSERT INTO file_version_creation(version_id) VALUES ($1)`);
          });
          break;
        } catch (err) {
          if (err.code === '23505') {
            attempts++;
            const delay = config.INITIAL_BACKOFF_MS * Math.pow(2, attempts);
            logger.warn('Version conflict, retry attempt %d after %d ms', attempts, delay);
            await new Promise(r => setTimeout(r, delay));
          } else {
            throw err;
          }
        }
      }

      if (attempts === config.MAX_VERSION_RETRIES) {
        return res.status(500).json({ error: 'Version conflict. Please try again later.' });
      }

      const userDir = path.join(config.FINAL_UPLOAD_DIR, userId);
      const folderDir = path.join(userDir, folder_id);
      await ensureDir(folderDir);

      const safeFilename = sanitizeFilename(file.originalname);
      const finalFilename = `${newFileId}_${versionNumber}_${safeFilename}`;
      const finalPath = path.join(folderDir, finalFilename);

      await fs.rename(file.path, finalPath);

      res.json({
        message: 'File uploaded successfully',
        file_id: newFileId,
        version_id: versionId,
        version_number: versionNumber,
        filename: finalFilename,
        hash: fileHash,
      });
    } catch (err) {
      logger.error('Upload error: %o', err);
      if (file?.path) await fs.unlink(file.path).catch(() => {});
      res.status(500).json({ error: 'Failed to upload file due to server error.' });
    }
  });

  return router;
}

module.exports = { createUploadRouter, initClamScan };