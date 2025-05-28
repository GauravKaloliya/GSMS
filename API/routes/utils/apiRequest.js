const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const zlib = require('zlib');
const { runWithTransaction } = require('../../db');

const MAX_BODY_SIZE = 1e6; // 1MB max for request body capture
const MAX_RES_BODY_SIZE = 1e6; // 1MB max for response body capture

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function compressIfLarge(buffer) {
  try {
    if (!buffer || buffer.length < 1024) return buffer;
    return zlib.gzipSync(buffer);
  } catch {
    return buffer;
  }
}

// Middleware to capture raw request body BEFORE JSON parsing
function captureRawBodyMiddleware(req, res, next) {
  const chunks = [];
  let length = 0;

  req.on('data', (chunk) => {
    length += chunk.length;
    if (length > MAX_BODY_SIZE) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(chunks);
    next();
  });

  req.on('error', () => {
    req.rawBody = Buffer.alloc(0);
    next();
  });
}

// Middleware to capture response body up to a max size
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

// Main middleware to log API request and response to DB after response finished
async function logApiRequest(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  onFinished(res, async () => {
    try {
      const endTime = Date.now();

      const rawReqBody = req.rawBody || Buffer.alloc(0);
      const compressedReqBody = compressIfLarge(rawReqBody);

      const resBody = res.locals.responseBody || Buffer.alloc(0);
      const compressedResBody = compressIfLarge(resBody);

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
      console.error('[Non-blocking log failure]', error.message);
    }
  });

  next();
}

module.exports = {
  captureRawBodyMiddleware,
  captureResponseBody,
  logApiRequest,
};