import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('WebhookLogging');

export async function logReceived(req, parsed) {
  const result = await db.query(
    `INSERT INTO webhook_log (
      webhook_type, notification_type, event_name, payload,
      media_title, media_type, tmdb_id, tvdb_id, request_id,
      requested_by_username, requested_by_email, is_4k,
      processing_status, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING id`,
    [
      'overseerr',
      parsed.notification_type,
      parsed.event_name,
      JSON.stringify(req.body),
      parsed.title,
      parsed.media_type,
      parsed.tmdb_id,
      parsed.tvdb_id,
      parsed.request_id,
      parsed.requested_by_username,
      parsed.requested_by_email,
      parsed.is_4k,
      'received',
      req.ip || req.connection?.remoteAddress,
      req.get('user-agent'),
    ],
  );

  logger.info('Webhook received', {
    logId: result.rows[0].id,
    notification_type: parsed.notification_type,
    media_type: parsed.media_type,
    title: parsed.title,
  });

  return result.rows[0].id;
}

export async function updateLogStatus(logId, status, result = {}) {
  const endTime = Date.now();

  const logResult = await db.query(
    'SELECT received_at FROM webhook_log WHERE id = $1',
    [logId],
  );

  const processingTime = logResult.rows[0]
    ? endTime - new Date(logResult.rows[0].received_at).getTime()
    : 0;

  await db.query(
    `UPDATE webhook_log
     SET processing_status = $1,
         classification_id = $2,
         routed_to_library = $3,
         error_message = $4,
         processing_time_ms = $5
     WHERE id = $6`,
    [
      status,
      result.classification_id || null,
      result.library || null,
      result.error || null,
      processingTime,
      logId,
    ],
  );

  logger.info('Webhook log updated', {
    logId,
    status,
    processingTime: `${processingTime}ms`,
  });
}

export async function trackRequest(parsed, classificationResult = {}) {
  const result = await db.query(
    `INSERT INTO media_requests (
      overseerr_request_id, tmdb_id, tvdb_id, media_type, title, year,
      poster_path, requested_by_username, requested_by_email, requested_by_avatar,
      is_4k, requested_seasons, request_status, classification_id,
      routed_to_library_name, requested_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (overseerr_request_id) DO UPDATE
    SET tmdb_id = EXCLUDED.tmdb_id,
        tvdb_id = EXCLUDED.tvdb_id,
        media_type = EXCLUDED.media_type,
        title = EXCLUDED.title,
        classification_id = EXCLUDED.classification_id,
        routed_to_library_name = EXCLUDED.routed_to_library_name,
        updated_at = NOW()
    RETURNING id`,
    [
      parsed.request_id,
      parsed.tmdb_id,
      parsed.tvdb_id,
      parsed.media_type,
      parsed.title,
      parsed.year,
      parsed.poster_path,
      parsed.requested_by_username,
      parsed.requested_by_email,
      parsed.requested_by_avatar,
      parsed.is_4k,
      parsed.requested_seasons,
      'pending',
      classificationResult.classification_id || null,
      classificationResult.library || null,
      parsed.requested_at || new Date(),
    ],
  );

  logger.info('Request tracked', {
    requestId: parsed.request_id,
    mediaRequestId: result.rows[0].id,
    title: parsed.title,
  });

  return result.rows[0].id;
}

export async function updateRequestStatus(parsed, status) {
  if (!parsed.request_id) {
    logger.warn('Cannot update request status: no request_id provided');
    return;
  }

  const statusField = status === 'approved'
    ? 'approved_at'
    : (status === 'available' ? 'available_at' : null);

  const query = statusField
    ? `UPDATE media_requests
       SET request_status = $1, ${statusField} = NOW(), updated_at = NOW()
       WHERE overseerr_request_id = $2`
    : `UPDATE media_requests
       SET request_status = $1, updated_at = NOW()
       WHERE overseerr_request_id = $2`;

  await db.query(query, [status, parsed.request_id]);

  logger.info('Request status updated', {
    requestId: parsed.request_id,
    status,
  });
}

export async function getStats() {
  const totalResult = await db.query('SELECT COUNT(*) FROM webhook_log');
  const completedResult = await db.query(
    "SELECT COUNT(*) FROM webhook_log WHERE processing_status = 'completed'",
  );
  const failedResult = await db.query(
    "SELECT COUNT(*) FROM webhook_log WHERE processing_status = 'failed'",
  );
  const last24hResult = await db.query(
    "SELECT COUNT(*) FROM webhook_log WHERE received_at > NOW() - INTERVAL '24 hours'",
  );
  const avgTimeResult = await db.query(
    'SELECT AVG(processing_time_ms) FROM webhook_log WHERE processing_time_ms IS NOT NULL',
  );

  return {
    total: parseInt(totalResult.rows[0].count, 10),
    completed: parseInt(completedResult.rows[0].count, 10),
    failed: parseInt(failedResult.rows[0].count, 10),
    last24h: parseInt(last24hResult.rows[0].count, 10),
    avgProcessingTime: avgTimeResult.rows[0].avg
      ? Math.round(parseFloat(avgTimeResult.rows[0].avg))
      : 0,
  };
}

export async function getLogs(options = {}) {
  const { page = 1, limit = 50, status, media_type } = options;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM webhook_log WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND processing_status = $${paramIndex}`;
    params.push(status);
    paramIndex += 1;
  }

  if (media_type) {
    query += ` AND media_type = $${paramIndex}`;
    params.push(media_type);
    paramIndex += 1;
  }

  query += ` ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await db.query(query, params);

  let countQuery = 'SELECT COUNT(*) FROM webhook_log WHERE 1=1';
  const countParams = [];
  let countParamIndex = 1;

  if (status) {
    countQuery += ` AND processing_status = $${countParamIndex}`;
    countParams.push(status);
    countParamIndex += 1;
  }

  if (media_type) {
    countQuery += ` AND media_type = $${countParamIndex}`;
    countParams.push(media_type);
  }

  const countResult = await db.query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count, 10);

  return {
    logs: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
