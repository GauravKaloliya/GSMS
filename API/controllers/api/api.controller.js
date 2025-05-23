const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const zlib = require('zlib');
const { runWithTransaction } = require('../../db');

// Configurable max size to avoid memory bloat
const MAX_BODY_SIZE = 1e6; // 1 MB

// Capture raw request body with a strict size limit, returns Promise to await in middleware
function captureRawBody(req) {
  return new Promise((resolve, reject) => {
    let totalLength = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      totalLength += chunk.length;
      if (totalLength > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Payload Too Large'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

// Middleware: Capture request & response info + log AFTER response is sent
async function logApiRequest(req, res, next) {
  const requestId = uuidv4();
  const startTime = new Date();

  // Capture raw body upfront
  let rawBody = Buffer.alloc(0);
  try {
    rawBody = await captureRawBody(req);
  } catch (e) {
    // Payload too large or other errors, just proceed with empty body
    console.warn(`[Warning] Raw body capture failed: ${e.message}`);
  }

  // Hook into response finishing to log data
  onFinished(res, async (err) => {
    if (err) {
      console.error('[Request Finished Error]', err);
      return;
    }

    try {
      const endTime = new Date();

      // Defensive JSON stringify
      const safeStringify = (obj) => {
        try {
          return JSON.stringify(obj);
        } catch {
          return null;
        }
      };

      // Compress request and response bodies if large
      const compressIfLarge = (buffer) => {
        if (!buffer || buffer.length < 1024) return buffer;
        return zlib.gzipSync(buffer);
      };

      const compressedReqBody = compressIfLarge(rawBody);
      const resBodyBuffer = res.locals.responseBody || Buffer.alloc(0);
      const compressedResBody = compressIfLarge(resBodyBuffer);

      // Extract user info safely
      const uid = req.user?.uid || null;
      const sid = req.user?.sid || null;
      const apiKeyId = req.apiKeyId || null;

      // Insert into partitioned api_request and api_request_event tables transactionally
      await runWithTransaction(async (q) => {
        await q(`INSERT INTO api_request (request_id) VALUES ($1)`, [requestId]);

        await q(
          `INSERT INTO api_request_event (
            request_id,
            user_id,
            api_key_id,
            session_id,
            request_time,
            http_method,
            endpoint,
            query_params,
            request_headers,
            request_body,
            ip_address,
            user_agent,
            response_time,
            http_status,
            response_headers,
            response_body,
            response_size_bytes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17
          )`,
          [
            requestId,
            uid,
            apiKeyId,
            sid,
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

// Middleware to capture response body with minimal overhead
function captureResponseBody(req, res, next) {
  const chunks = [];
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, encoding, callback) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    return originalWrite.call(res, chunk, encoding, callback);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    res.locals.responseBody = Buffer.concat(chunks);
    return originalEnd.call(res, chunk, encoding, callback);
  };

  next();
}

module.exports = {
  captureResponseBody,
  logApiRequest,
};