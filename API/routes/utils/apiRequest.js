const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const zlib = require('zlib');
const { runWithTransaction } = require('../../db');

const MAX_BODY_SIZE = 1e6; // 1MB max raw request body
const MAX_RES_BODY_SIZE = 1e6; // 1MB max response buffer

// Efficient safe stringify: fallback to null on error
function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

// Compress buffer if >1KB
function compressIfLarge(buf) {
  if (!buf || buf.length < 1024) return buf;
  return zlib.gzipSync(buf);
}

// Capture raw request body with size limit, returns Promise
function captureRawBody(req) {
  return new Promise((resolve, reject) => {
    let length = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Payload Too Large'));
        return;
      }
      chunks.push(chunk);
    });

    req.once('end', () => resolve(Buffer.concat(chunks)));
    req.once('error', reject);
  });
}

// Middleware to capture response body with cap
function captureResponseBody(req, res, next) {
  const chunks = [];
  let totalLength = 0;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, encoding, callback) {
    if (chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buf.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buf);
        totalLength += buf.length;
      }
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buf.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buf);
        totalLength += buf.length;
      }
    }
    res.locals.responseBody = Buffer.concat(chunks);
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

// Main logging middleware
async function logApiRequest(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  let rawBody = Buffer.alloc(0);
  try {
    rawBody = await captureRawBody(req);
  } catch (err) {
    console.warn(`[Warning] Failed to capture raw body: ${err.message}`);
  }

  onFinished(res, async (err) => {
    if (err) {
      console.error('[Request Finished Error]', err);
      return;
    }

    try {
      const endTime = Date.now();

      const compressedReqBody = compressIfLarge(rawBody);
      const resBodyBuffer = res.locals.responseBody || Buffer.alloc(0);
      const compressedResBody = compressIfLarge(resBodyBuffer);

      await runWithTransaction(async (q) => {
        await q(`INSERT INTO api_request (request_id) VALUES ($1)`, [requestId]);

        await q(
          `INSERT INTO api_request_event (
            request_id, user_id, api_key_id, session_id, request_time,
            http_method, endpoint, query_params, request_headers, request_body,
            ip_address, user_agent, response_time, http_status, response_headers,
            response_body, response_size_bytes
          ) VALUES (
            $1, $2, $3, $4, to_timestamp($5 / 1000.0), $6, $7, $8, $9, $10,
            $11, $12, to_timestamp($13 / 1000.0), $14, $15, $16, $17
          )`,
          [
            requestId,
            req.user?.uid || null,
            req.apiKeyId || null,
            req.user?.sid || null,
            startTime,
            req.method,
            req.originalUrl,
            safeStringify(req.query),
            safeStringify(req.headers),
            compressedReqBody,
            req.ip,
            req.headers['user-agent'] || null,
            endTime,
            res.statusCode,
            safeStringify(res.getHeaders()),
            compressedResBody,
            Number(res.getHeader('content-length')) || null,
          ]
        );
      });
    } catch (dbErr) {
      console.error('[DB Insert api_request_event Error]', dbErr);
    }
  });

  next();
}

module.exports = {
  captureResponseBody,
  logApiRequest,
};