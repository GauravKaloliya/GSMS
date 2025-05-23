const { v4: uuidv4 } = require('uuid');
const onFinished = require('on-finished');
const zlib = require('zlib');
const { runWithTransaction } = require('../../db');

const MAX_BODY_SIZE = 1e6; // 1MB
const MAX_RES_BODY_SIZE = 1e6; // 1MB

function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function compressIfLarge(buf) {
  try {
    if (!buf || buf.length < 1024) return buf;
    return zlib.gzipSync(buf);
  } catch {
    return buf;
  }
}

function captureRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let length = 0;

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY_SIZE) {
        req.destroy(); // cancel request if too large
        return resolve(Buffer.alloc(0));
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

  const origWrite = res.write;
  const origEnd = res.end;

  res.write = function (chunk, encoding, cb) {
    if (chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buf.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buf);
        totalLength += buf.length;
      }
    }
    return origWrite.call(this, chunk, encoding, cb);
  };

  res.end = function (chunk, encoding, cb) {
    if (chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
      if (totalLength + buf.length <= MAX_RES_BODY_SIZE) {
        chunks.push(buf);
        totalLength += buf.length;
      }
    }
    res.locals.responseBody = Buffer.concat(chunks);
    return origEnd.call(this, chunk, encoding, cb);
  };

  next();
}

async function logApiRequest(req, res, next) {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Don't await here
  // Instead, capture raw body after response ends inside onFinished

  onFinished(res, async () => {
    try {
      // Now read raw body here, after response ends
      const rawBody = await captureRawBody(req);

      const endTime = Date.now();
      const compressedReq = compressIfLarge(rawBody);
      const resBody = res.locals.responseBody || Buffer.alloc(0);
      const compressedRes = compressIfLarge(resBody);

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
            compressedReq,
            req.ip,
            req.headers['user-agent'] || null,
            endTime,
            res.statusCode,
            safeStringify(res.getHeaders()),
            compressedRes,
            Number(res.getHeader('content-length')) || null,
          ]
        );
      });
    } catch (err) {
      console.warn('[Non-blocking log failure]', err.message);
    }
  });

  next(); // immediately pass to next middleware without waiting
}

module.exports = {
  captureResponseBody,
  logApiRequest,
};