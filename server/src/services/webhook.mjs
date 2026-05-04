/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  _isEncrypted as isEncrypted,
  _maskConfig as maskConfig,
  _maskConfigs,
  _encryptSecret as encryptSecret,
  _decryptSecret as decryptSecret,
  normalizeSecretKeyInput,
  generateSecretKey,
  validateAuth as validateAuthShared,
  sanitizePayload,
  parsePayload,
} from './webhookServiceShared.mjs';

const logger = createLogger('WebhookService');

async function validateAuth(...args) {
  return validateAuthShared(...args);
}

async function rotateSecretAfterDecryptFailure(id) {
  const newSecret = generateSecretKey();
  const encryptedSecret = encryptSecret(newSecret);
  await db.query(
    `UPDATE webhook_config
     SET secret_key = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [encryptedSecret, id],
  );
  logger.warn(
    'Rotated webhook secret after decrypt failure',
    {
      configId: id,
      reason: 'encryption_key_mismatch_or_corruption',
    },
    { skipDbPersist: true },
  );
  return newSecret;
}

async function getConfig(options = {}) {
  const { mask = true } = options;
  const result = await db.query(
    'SELECT * FROM webhook_config WHERE webhook_type = $1 AND enabled = true LIMIT 1',
    ['overseerr'],
  );
  const config = result.rows[0]
    ? { ...result.rows[0] }
    : {
      enabled: true,
      process_pending: true,
      process_approved: true,
      process_auto_approved: true,
      process_declined: false,
      notify_on_receive: true,
      notify_on_error: true,
      include_specials: false,
    };

  return mask ? maskConfig(config) : config;
}

async function getFullSecret(options = {}) {
  const { autoRecover = true } = options;
  const result = await db.query(
    'SELECT id, secret_key FROM webhook_config WHERE webhook_type = $1 LIMIT 1',
    ['overseerr'],
  );
  if (!result.rows[0] || !result.rows[0].secret_key) {
    return null;
  }

  const { id, secret_key: storedSecret } = result.rows[0];

  if (!isEncrypted(storedSecret)) {
    return storedSecret;
  }

  try {
    return decryptSecret(storedSecret);
  } catch (error) {
    logger.warn(
      'Failed to decrypt webhook secret',
      {
        error: error.message,
        autoRecover,
      },
      { skipDbPersist: true },
    );

    if (autoRecover && id) {
      return rotateSecretAfterDecryptFailure(id);
    }

    return null;
  }
}

async function updateConfig(config) {
  const {
    secret_key,
    process_pending,
    process_approved,
    process_auto_approved,
    process_declined,
    notify_on_receive,
    notify_on_error,
    enabled,
    include_specials,
  } = config;

  const finalSecretKey = normalizeSecretKeyInput(secret_key);

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
         include_specials = COALESCE($9, include_specials),
         updated_at = NOW()
     WHERE webhook_type = $10
     RETURNING *`,
    [
      finalSecretKey,
      process_pending,
      process_approved,
      process_auto_approved,
      process_declined,
      notify_on_receive,
      notify_on_error,
      enabled,
      include_specials,
      'overseerr',
    ],
  );

  if (result.rows.length === 0) {
    const newSecret = generateSecretKey();
    const encryptedSecret = encryptSecret(newSecret);

    const insertResult = await db.query(
      `INSERT INTO webhook_config (
        webhook_type, secret_key, process_pending, process_approved,
        process_auto_approved, process_declined, notify_on_receive,
        notify_on_error, enabled, include_specials
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        'overseerr',
        encryptedSecret,
        process_pending !== false,
        process_approved !== false,
        process_auto_approved !== false,
        process_declined === true,
        notify_on_receive !== false,
        notify_on_error !== false,
        enabled !== false,
        include_specials === true,
      ],
    );

    const inserted = insertResult.rows[0];
    inserted.secret_key = newSecret;
    return inserted;
  }

  return maskConfig(result.rows[0]);
}

async function logReceived(req, parsed) {
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

async function updateLogStatus(logId, status, result = {}) {
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

async function trackRequest(parsed, classificationResult = {}) {
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

async function updateRequestStatus(parsed, status) {
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

async function getStats() {
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

async function getLogs(options = {}) {
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

async function getAllConfigs() {
  const result = await db.query(
    'SELECT id, name, webhook_type, manager_url, is_primary, enabled, include_specials, created_at FROM webhook_config ORDER BY is_primary DESC, created_at ASC',
  );
  return result.rows;
}

async function getConfigById(id) {
  const result = await db.query('SELECT * FROM webhook_config WHERE id = $1', [id]);
  return maskConfig(result.rows[0] || null);
}

async function createConfig(config) {
  const {
    name,
    webhook_type = 'overseerr',
    manager_url = null,
    is_primary = false,
    secret_key,
    process_pending = true,
    process_approved = true,
    process_auto_approved = true,
    process_declined = false,
    notify_on_receive = true,
    notify_on_error = true,
    enabled = true,
    include_specials = false,
  } = config;

  if (is_primary) {
    await db.query('UPDATE webhook_config SET is_primary = false WHERE is_primary = true');
  }

  const newSecret = secret_key || generateSecretKey();
  const encryptedSecret = encryptSecret(newSecret);

  const result = await db.query(
    `INSERT INTO webhook_config (
      name, webhook_type, manager_url, is_primary, secret_key,
      process_pending, process_approved, process_auto_approved, process_declined,
      notify_on_receive, notify_on_error, enabled, include_specials
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      name,
      webhook_type,
      manager_url,
      is_primary,
      encryptedSecret,
      process_pending,
      process_approved,
      process_auto_approved,
      process_declined,
      notify_on_receive,
      notify_on_error,
      enabled,
      include_specials,
    ],
  );

  const inserted = result.rows[0];
  inserted.secret_key = newSecret;
  return inserted;
}

async function updateConfigById(id, config) {
  const {
    name,
    webhook_type,
    manager_url,
    is_primary,
    secret_key,
    process_pending,
    process_approved,
    process_auto_approved,
    process_declined,
    notify_on_receive,
    notify_on_error,
    enabled,
    include_specials,
  } = config;

  if (is_primary) {
    await db.query(
      'UPDATE webhook_config SET is_primary = false WHERE is_primary = true AND id != $1',
      [id],
    );
  }

  const encryptedSecret = normalizeSecretKeyInput(secret_key);

  const result = await db.query(
    `UPDATE webhook_config SET
      name = COALESCE($1, name),
      webhook_type = COALESCE($2, webhook_type),
      manager_url = COALESCE($3, manager_url),
      is_primary = COALESCE($4, is_primary),
      secret_key = COALESCE($5, secret_key),
      process_pending = COALESCE($6, process_pending),
      process_approved = COALESCE($7, process_approved),
      process_auto_approved = COALESCE($8, process_auto_approved),
      process_declined = COALESCE($9, process_declined),
      notify_on_receive = COALESCE($10, notify_on_receive),
      notify_on_error = COALESCE($11, notify_on_error),
      enabled = COALESCE($12, enabled),
      include_specials = COALESCE($13, include_specials),
      updated_at = NOW()
    WHERE id = $14
    RETURNING *`,
    [
      name,
      webhook_type,
      manager_url,
      is_primary,
      encryptedSecret,
      process_pending,
      process_approved,
      process_auto_approved,
      process_declined,
      notify_on_receive,
      notify_on_error,
      enabled,
      include_specials,
      id,
    ],
  );

  return maskConfig(result.rows[0]);
}

async function deleteConfig(id) {
  const countResult = await db.query('SELECT COUNT(*) FROM webhook_config');
  if (parseInt(countResult.rows[0].count, 10) <= 1) {
    throw new Error('Cannot delete the only webhook configuration');
  }

  const configResult = await db.query('SELECT is_primary FROM webhook_config WHERE id = $1', [id]);
  const wasPrimary = configResult.rows[0]?.is_primary;

  await db.query('DELETE FROM webhook_config WHERE id = $1', [id]);

  if (wasPrimary) {
    await db.query(
      'UPDATE webhook_config SET is_primary = true WHERE id = (SELECT MIN(id) FROM webhook_config)',
    );
  }

  return true;
}

async function setPrimaryConfig(id) {
  await db.query('UPDATE webhook_config SET is_primary = false WHERE is_primary = true');
  const result = await db.query(
    'UPDATE webhook_config SET is_primary = true WHERE id = $1 RETURNING *',
    [id],
  );
  return maskConfig(result.rows[0]);
}

async function ensureSecretKey() {
  const result = await db.query(
    'SELECT id, secret_key FROM webhook_config WHERE webhook_type = $1 LIMIT 1',
    ['overseerr'],
  );

  if (result.rows.length === 0) {
    const newSecret = generateSecretKey();
    const encryptedSecret = encryptSecret(newSecret);

    await db.query(
      `INSERT INTO webhook_config (webhook_type, secret_key, enabled)
       VALUES ($1, $2, true)
       RETURNING *`,
      ['overseerr', encryptedSecret],
    );

    logger.info('✓ Auto-generated webhook secret key');
    logger.info('  You can view this key in Settings → Webhooks');
    return newSecret;
  }

  const existing = result.rows[0];
  if (!existing.secret_key) {
    const newSecret = generateSecretKey();
    const encryptedSecret = encryptSecret(newSecret);

    await db.query(
      'UPDATE webhook_config SET secret_key = $1 WHERE id = $2',
      [encryptedSecret, existing.id],
    );

    logger.info('✓ Auto-generated webhook secret key');
    logger.info('  You can view this key in Settings → Webhooks');
    return newSecret;
  }

  if (isEncrypted(existing.secret_key)) {
    try {
      decryptSecret(existing.secret_key);
    } catch (error) {
      logger.warn(
        'Existing webhook secret cannot be decrypted, rotating secret',
        { error: error.message, configId: existing.id },
        { skipDbPersist: true },
      );
      return rotateSecretAfterDecryptFailure(existing.id);
    }
  }

  return null;
}

const webhookService = {
  _isEncrypted: isEncrypted,
  _maskConfig: maskConfig,
  _maskConfigs: _maskConfigs,
  _encryptSecret: encryptSecret,
  _decryptSecret: decryptSecret,
  generateSecretKey,
  validateAuth,
  sanitizePayload,
  parsePayload,
  getConfig,
  getFullSecret,
  updateConfig,
  logReceived,
  updateLogStatus,
  trackRequest,
  updateRequestStatus,
  getStats,
  getLogs,
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfigById,
  deleteConfig,
  setPrimaryConfig,
  ensureSecretKey,
};

export {
  isEncrypted as _isEncrypted,
  maskConfig as _maskConfig,
  _maskConfigs,
  encryptSecret as _encryptSecret,
  decryptSecret as _decryptSecret,
  generateSecretKey,
  validateAuth,
  sanitizePayload,
  parsePayload,
  getConfig,
  getFullSecret,
  updateConfig,
  logReceived,
  updateLogStatus,
  trackRequest,
  updateRequestStatus,
  getStats,
  getLogs,
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfigById,
  deleteConfig,
  setPrimaryConfig,
  ensureSecretKey,
};

export default webhookService;
