const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const zlib = require('zlib');
const { runWithTransaction } = require('../../db');

const MAX_BODY_SIZE = 1e6;       // 1MB max for request body capture
const MAX_RES_BODY_SIZE = 1e6;   // 1MB max for response body capture

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function compressIfLarge(buffer) {
  try {
    if (!buffer || buffer.length < 1024) return buffer; // Only compress if >1KB
    return zlib.gzipSync(buffer);
  } catch {
    return buffer;
  }
}

async function captureRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let length = 0;

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_SIZE) {
        req.destroy();
        return resolve(Buffer.alloc(0)); // Return empty buffer if too large
      }
      chunks.push(chunk);
    });

    req.once('end', () => resolve(Buffer.concat(chunks)));
    req.once('error', () => resolve(Buffer.alloc(0)));
  });
}

function captureResponseBody(req, res, next) {
  const chunks = [];
  let totalLength = 0;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, encoding, callback) {
    if (chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buffer.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buffer);
        totalLength += buffer.length;
      }
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buffer.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buffer);
        totalLength += buffer.length;
      }
    }
    res.locals.responseBody = Buffer.concat(chunks);
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
}

async function logApiRequest(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Capture raw request body asynchronously before response finishes
  const rawBodyPromise = captureRawBody(req).then(rawBody => {
    res.locals.rawBody = rawBody;
  });

  // After response finished, log request and response info in DB
  onFinished(res, async () => {
    try {
      await rawBodyPromise;

      const endTime = Date.now();

      const rawReqBody = res.locals.rawBody || Buffer.alloc(0);
      const compressedReqBody = compressIfLarge(rawReqBody);

      const resBody = res.locals.responseBody || Buffer.alloc(0);
      const compressedResBody = compressIfLarge(resBody);

      console.log(`[${endTime - startTime}ms] ${req.method} ${req.originalUrl} ${res.statusCode}`);

      await runWithTransaction(async (query) => {
        await query(`INSERT INTO api_request (request_id) VALUES ($1)`, [requestId]);

        await query(
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
    } catch (error) {
      // Non-blocking: log the error but don't affect response
      console.error('[Non-blocking log failure]', error.message);
    }
  });

  next();
}

module.exports = {
  captureResponseBody,
  logApiRequest,
};