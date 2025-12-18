const db = require('../config/database');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');
const logger = createLogger('WebhookService');

class WebhookService {
  async getConfig() {
    const result = await db.query('SELECT * FROM webhook_config WHERE webhook_type = $1 LIMIT 1', ['overseerr']);
    return result.rows[0] || { 
      enabled: true, 
      process_pending: true, 
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true
    };
  }

  async updateConfig(config) {
    const {
      secret_key,
      process_pending,
      process_approved,
      process_auto_approved,
      process_declined,
      notify_on_receive,
      notify_on_error,
      enabled
    } = config;

    const result = await db.query(
      `UPDATE webhook_config
       SET secret_key = COALESCE($1, secret_key),
           process_pending = COALESCE($2, process_pending),
           process_approved = COALESCE($3, process_approved),
           process_auto_approved = COALESCE($4, process_auto_approved),
           process_declined = COALESCE($5, process_declined),
           notify_on_receive = COALESCE($6, notify_on_receive),
           notify_on_error = COALESCE($7, notify_on_error),
           enabled = COALESCE($8, enabled),
           updated_at = NOW()
       WHERE webhook_type = $9
       RETURNING *`,
      [
        secret_key,
        process_pending,
        process_approved,
        process_auto_approved,
        process_declined,
        notify_on_receive,
        notify_on_error,
        enabled,
        'overseerr'
      ]
    );

    if (result.rows.length === 0) {
      // Insert if doesn't exist
      const insertResult = await db.query(
        `INSERT INTO webhook_config (
          webhook_type, secret_key, process_pending, process_approved, 
          process_auto_approved, process_declined, notify_on_receive, 
          notify_on_error, enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          'overseerr',
          secret_key,
          process_pending !== false,
          process_approved !== false,
          process_auto_approved !== false,
          process_declined === true,
          notify_on_receive !== false,
          notify_on_error !== false,
          enabled !== false
        ]
      );
      return insertResult.rows[0];
    }

    return result.rows[0];
  }

  generateSecretKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateAuth(providedKey, config) {
    if (!config.secret_key) return true; // No key required
    return providedKey === config.secret_key;
  }

  parsePayload(body) {
    logger.debug('Parsing webhook payload', { body });
    
    const notification_type = body.notification_type || body.event;
    const subject = body.subject || '';
    
    // Extract media information
    const media = body.media || {};
    const request = body.request || {};
    const requestedBy = request.requestedBy || body.requestedBy || {};
    
    // Determine media type
    let media_type = media.media_type || media.mediaType;
    if (!media_type) {
      // Fallback: try to infer from subject
      media_type = subject.includes('Movie') ? 'movie' : 'tv';
    }
    
    const parsed = {
      notification_type,
      event_name: body.event || notification_type,
      media_type,
      tmdb_id: media.tmdbId || media.tmdb_id,
      tvdb_id: media.tvdbId || media.tvdb_id,
      request_id: request.id || body.request_id,
      title: subject || media.title || media.name,
      year: media.releaseDate ? new Date(media.releaseDate).getFullYear() : null,
      poster_path: media.posterPath || media.poster_path,
      is_4k: request.is4k || body.is_4k || false,
      requested_by_username: requestedBy.username || requestedBy.displayName,
      requested_by_email: requestedBy.email,
      requested_by_avatar: requestedBy.avatar,
      requested_seasons: request.seasons ? JSON.stringify(request.seasons) : null,
      requested_at: request.createdAt || body.createdAt
    };

    logger.debug('Parsed webhook payload', { parsed });
    return parsed;
  }

  async logReceived(req, parsed) {
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
        req.get('user-agent')
      ]
    );

    logger.info('Webhook received', {
      logId: result.rows[0].id,
      notification_type: parsed.notification_type,
      media_type: parsed.media_type,
      title: parsed.title
    });

    return result.rows[0].id;
  }

  async updateLogStatus(logId, status, result = {}) {
    const endTime = Date.now();
    
    // Get the start time from the log
    const logResult = await db.query(
      'SELECT received_at FROM webhook_log WHERE id = $1',
      [logId]
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
        logId
      ]
    );

    logger.info('Webhook log updated', {
      logId,
      status,
      processingTime: `${processingTime}ms`
    });
  }

  async trackRequest(parsed, classificationResult = {}) {
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
        parsed.requested_at || new Date()
      ]
    );

    logger.info('Request tracked', {
      requestId: parsed.request_id,
      mediaRequestId: result.rows[0].id,
      title: parsed.title
    });

    return result.rows[0].id;
  }

  async updateRequestStatus(parsed, status) {
    if (!parsed.request_id) {
      logger.warn('Cannot update request status: no request_id provided');
      return;
    }

    const statusField = status === 'approved' ? 'approved_at' : 
                       status === 'available' ? 'available_at' : null;

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
      status
    });
  }

  async getStats() {
    const totalResult = await db.query('SELECT COUNT(*) FROM webhook_log');
    const completedResult = await db.query(
      "SELECT COUNT(*) FROM webhook_log WHERE processing_status = 'completed'"
    );
    const failedResult = await db.query(
      "SELECT COUNT(*) FROM webhook_log WHERE processing_status = 'failed'"
    );
    const last24hResult = await db.query(
      "SELECT COUNT(*) FROM webhook_log WHERE received_at > NOW() - INTERVAL '24 hours'"
    );
    const avgTimeResult = await db.query(
      "SELECT AVG(processing_time_ms) FROM webhook_log WHERE processing_time_ms IS NOT NULL"
    );

    return {
      total: parseInt(totalResult.rows[0].count),
      completed: parseInt(completedResult.rows[0].count),
      failed: parseInt(failedResult.rows[0].count),
      last24h: parseInt(last24hResult.rows[0].count),
      avgProcessingTime: avgTimeResult.rows[0].avg 
        ? Math.round(parseFloat(avgTimeResult.rows[0].avg)) 
        : 0
    };
  }

  async getLogs(options = {}) {
    const { page = 1, limit = 50, status, media_type } = options;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM webhook_log WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND processing_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (media_type) {
      query += ` AND media_type = $${paramIndex}`;
      params.push(media_type);
      paramIndex++;
    }

    query += ` ORDER BY received_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM webhook_log WHERE 1=1';
    const countParams = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND processing_status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (media_type) {
      countQuery += ` AND media_type = $${countParamIndex}`;
      countParams.push(media_type);
    }

    const countResult = await db.query(countQuery, countParams);

    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    };
  }
}

module.exports = new WebhookService();
