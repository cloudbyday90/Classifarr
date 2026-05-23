import * as db from '../config/database.mjs';
import {
  isEncrypted,
  maskConfig,
  maskConfigs,
  encryptSecret,
  decryptSecret,
  normalizeSecretKeyInput,
  generateSecretKey,
  validateAuth as validateAuthShared,
  sanitizePayload,
  parsePayload,
} from './webhookServiceShared.mjs';
import {
  getFullSecret,
  ensureSecretKey,
} from './webhookSecretManagement.mjs';
import {
  logReceived,
  updateLogStatus,
  trackRequest,
  updateRequestStatus,
  getStats,
  getLogs,
} from './webhookLogging.mjs';
import {
  getAllConfigs,
  getConfigById,
  createConfig,
  updateConfigById,
  deleteConfig,
  setPrimaryConfig,
} from './webhookConfigCrud.mjs';

async function validateAuth(...args) {
  return validateAuthShared(...args);
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

export const webhookService = {
  isEncrypted,
  maskConfig,
  maskConfigs,
  encryptSecret,
  decryptSecret,
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
  isEncrypted,
  maskConfig,
  maskConfigs,
  encryptSecret,
  decryptSecret,
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
