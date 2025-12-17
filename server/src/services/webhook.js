const db = require('../config/database');
const crypto = require('crypto');

class WebhookService {
  /**
   * Get webhook configuration
   */
  async getConfig() {
    const result = await db.query('SELECT * FROM webhook_config WHERE webhook_type = $1 LIMIT 1', ['overseerr']);
    return result.rows[0] || { enabled: true, process_pending: true, process_approved: true, process_auto_approved: true };
  }

  /**
   * Update webhook configuration
   */
  async updateConfig(config) {
    const result = await db.query(`
      INSERT INTO webhook_config (webhook_type, secret_key, process_pending, process_approved, process_auto_approved, process_declined, notify_on_receive, notify_on_error, enabled)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (webhook_type) DO UPDATE SET
        secret_key = EXCLUDED.secret_key,
        process_pending = EXCLUDED.process_pending,
        process_approved = EXCLUDED.process_approved,
        process_auto_approved = EXCLUDED.process_auto_approved,
        process_declined = EXCLUDED.process_declined,
        notify_on_receive = EXCLUDED.notify_on_receive,
        notify_on_error = EXCLUDED.notify_on_error,
        enabled = EXCLUDED.enabled,
        updated_at = NOW()
      RETURNING *
    `, [
      'overseerr',
      config.secret_key,
      config.process_pending ?? true,
      config.process_approved ?? true,
      config.process_auto_approved ?? true,
      config.process_declined ?? false,
      config.notify_on_receive ?? true,
      config.notify_on_error ?? true,
      config.enabled ?? true
    ]);
    return result.rows[0];
  }

  /**
   * Generate a new webhook secret key
   */
  generateSecretKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate webhook authentication
   */
  validateAuth(providedKey, config) {
    if (!config.secret_key) return true; // No auth configured
    return providedKey === config.secret_key;
  }

  /**
   * Parse Overseerr webhook payload into normalized format
   */
  parsePayload(raw) {
    return {
      // Event info
      notification_type: raw.notification_type || 'UNKNOWN',
      event: raw.event || raw.subject || 'Unknown Event',
      subject: raw.subject || '',
      message: raw.message || '',
      
      // Media info
      media: {
        media_type: raw.media?.media_type || this.inferMediaType(raw),
        tmdb_id: raw.media?.tmdbId || this.extractTmdbId(raw),
        tvdb_id: raw.media?.tvdbId || null,
        imdb_id: raw.media?.imdbId || null,
        status: raw.media?.status || 'unknown',
        status_4k: raw.media?.status4k || 'unknown'
      },
      
      // Request info
      request: {
        request_id: raw.request?.request_id || null,
        requested_by_username: raw.request?.requestedBy_username || this.extractUsername(raw),
        requested_by_email: raw.request?.requestedBy_email || null,
        requested_by_avatar: raw.request?.requestedBy_avatar || null,
        is_4k: raw.request?.is4k || false
      },
      
      // Extra info (seasons, etc.)
      extra: raw.extra || [],
      requested_seasons: this.extractSeasons(raw.extra),
      
      // Image
      image: raw.image || null,
      
      // Raw payload for logging
      raw: raw
    };
  }

  inferMediaType(raw) {
    if (raw.subject?.toLowerCase().includes('movie')) return 'movie';
    if (raw.subject?.toLowerCase().includes('tv') || raw.subject?.toLowerCase().includes('series')) return 'tv';
    if (raw.media?.tvdbId) return 'tv';
    return 'movie'; // Default
  }

  extractTmdbId(raw) {
    if (raw.media?.tmdbId) return raw.media.tmdbId;
    // Check extra array for TMDB ID
    const tmdbExtra = raw.extra?.find(e => e.name?.toLowerCase().includes('tmdb'));
    if (tmdbExtra) return parseInt(tmdbExtra.value);
    return null;
  }

  extractUsername(raw) {
    // Try to extract from message: "username has requested..."
    const match = raw.message?.match(/^(\w+) has requested/i);
    return match ? match[1] : null;
  }

  extractSeasons(extra) {
    if (!extra || !Array.isArray(extra)) return null;
    const seasonExtra = extra.find(e => e.name?.toLowerCase().includes('season'));
    return seasonExtra?.value || null;
  }

  /**
   * Check if we should process this notification type
   */
  shouldProcess(notificationType, config) {
    switch (notificationType) {
      case 'MEDIA_PENDING':
        return config.process_pending;
      case 'MEDIA_APPROVED':
        return config.process_approved;
      case 'MEDIA_AUTO_APPROVED':
        return config.process_auto_approved;
      case 'MEDIA_DECLINED':
        return config.process_declined;
      case 'TEST_NOTIFICATION':
        return true; // Always process test
      default:
        return true; // Process unknown types
    }
  }

  /**
   * Log received webhook
   */
  async logReceived(req, parsed) {
    const result = await db.query(`
      INSERT INTO webhook_log (
        webhook_type, notification_type, event_name, payload,
        media_title, media_type, tmdb_id, tvdb_id,
        request_id, requested_by_username, requested_by_email, is_4k,
        processing_status, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `, [
      'overseerr',
      parsed.notification_type,
      parsed.event,
      JSON.stringify(parsed.raw),
      parsed.subject,
      parsed.media.media_type,
      parsed.media.tmdb_id,
      parsed.media.tvdb_id,
      parsed.request.request_id,
      parsed.request.requested_by_username,
      parsed.request.requested_by_email,
      parsed.request.is_4k,
      'received',
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent']
    ]);
    return result.rows[0].id;
  }

  /**
   * Update webhook log entry
   */
  async updateLog(logId, updates) {
    const setClauses = [];
    const values = [logId];
    let paramIndex = 2;

    if (updates.status) {
      setClauses.push(`processing_status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.classification_id) {
      setClauses.push(`classification_id = $${paramIndex++}`);
      values.push(updates.classification_id);
    }
    if (updates.routed_to_library) {
      setClauses.push(`routed_to_library = $${paramIndex++}`);
      values.push(updates.routed_to_library);
    }
    if (updates.error_message) {
      setClauses.push(`error_message = $${paramIndex++}`);
      values.push(updates.error_message);
    }
    if (updates.processing_time_ms) {
      setClauses.push(`processing_time_ms = $${paramIndex++}`);
      values.push(updates.processing_time_ms);
    }

    if (setClauses.length > 0) {
      await db.query(`UPDATE webhook_log SET ${setClauses.join(', ')} WHERE id = $1`, values);
    }
  }

  /**
   * Create or update media request tracking
   */
  async trackRequest(parsed, classificationResult) {
    const result = await db.query(`
      INSERT INTO media_requests (
        overseerr_request_id, tmdb_id, tvdb_id, media_type, title,
        requested_by_username, requested_by_email, requested_by_avatar,
        is_4k, requested_seasons, request_status,
        classification_id, routed_to_library_id, routed_to_library_name,
        requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
      ON CONFLICT (overseerr_request_id) DO UPDATE SET
        request_status = EXCLUDED.request_status,
        classification_id = EXCLUDED.classification_id,
        routed_to_library_id = EXCLUDED.routed_to_library_id,
        routed_to_library_name = EXCLUDED.routed_to_library_name,
        updated_at = NOW()
      RETURNING *
    `, [
      parsed.request.request_id,
      parsed.media.tmdb_id,
      parsed.media.tvdb_id,
      parsed.media.media_type,
      parsed.subject,
      parsed.request.requested_by_username,
      parsed.request.requested_by_email,
      parsed.request.requested_by_avatar,
      parsed.request.is_4k,
      parsed.requested_seasons,
      classificationResult?.declined ? 'declined' : 'processing',
      classificationResult?.classification_id,
      classificationResult?.library?.id,
      classificationResult?.library?.name
    ]);
    return result.rows[0];
  }

  /**
   * Update request status (for MEDIA_AVAILABLE, MEDIA_FAILED, etc.)
   */
  async updateRequestStatus(parsed, newStatus) {
    await db.query(`
      UPDATE media_requests 
      SET request_status = $1,
          ${newStatus === 'available' ? 'available_at = NOW(),' : ''}
          updated_at = NOW()
      WHERE overseerr_request_id = $2 OR tmdb_id = $3
    `, [newStatus, parsed.request.request_id, parsed.media.tmdb_id]);
  }

  /**
   * Get recent webhook logs
   */
  async getRecentLogs(limit = 50, offset = 0) {
    const result = await db.query(`
      SELECT * FROM webhook_log
      ORDER BY received_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  }

  /**
   * Get webhook statistics
   */
  async getStats() {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
        COUNT(*) FILTER (WHERE processing_status = 'skipped') as skipped,
        COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE received_at > NOW() - INTERVAL '7 days') as last_7d,
        AVG(processing_time_ms) FILTER (WHERE processing_status = 'completed') as avg_processing_time
      FROM webhook_log
    `);
    return result.rows[0];
  }

  /**
   * Get pending/recent media requests
   */
  async getRequests(options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    
    let query = 'SELECT * FROM media_requests';
    const params = [];
    
    if (status) {
      query += ' WHERE request_status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    return result.rows;
  }
}

module.exports = new WebhookService();
