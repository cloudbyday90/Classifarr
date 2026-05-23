import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  isEncrypted,
  encryptSecret,
  decryptSecret,
  generateSecretKey,
} from './webhookServiceShared.mjs';

const logger = createLogger('WebhookSecretManagement');

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

export async function getFullSecret(options = {}) {
  const { autoRecover = false } = options;
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

export async function ensureSecretKey() {
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
        'Existing webhook secret cannot be decrypted; preserving stored value until encryption key is restored or the secret is regenerated manually',
        {
          error: error.message,
          configId: existing.id,
          reason: 'encryption_key_mismatch_or_corruption',
        },
      );
      return null;
    }
  }

  return null;
}
