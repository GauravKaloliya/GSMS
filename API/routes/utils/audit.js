const { query } = require('../../db');

const logAuditEvent = async (query, type, detail) => {
  const idRes = await query(
    `INSERT INTO audit_log_identity DEFAULT VALUES RETURNING log_id`
  );
  const logId = idRes.rows[0].log_id;
  await query(
    `INSERT INTO audit_log_event (log_id, event_time, event_type, event_details)
     VALUES ($1, now(), $2, $3::jsonb)`,
    [logId, type, JSON.stringify(detail)]
  );
  return logId;
};

module.exports = {
  logAuditEvent
};