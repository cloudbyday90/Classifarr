import * as db from '../config/database.mjs';
import {
  maskConfig,
  encryptSecret,
  generateSecretKey,
  normalizeSecretKeyInput,
} from './webhookServiceShared.mjs';

export async function getAllConfigs() {
  const result = await db.query(
    'SELECT id, name, webhook_type, manager_url, is_primary, enabled, include_specials, created_at FROM webhook_config ORDER BY is_primary DESC, created_at ASC',
  );
  return result.rows;
}

export async function getConfigById(id) {
  const result = await db.query('SELECT * FROM webhook_config WHERE id = $1', [id]);
  return maskConfig(result.rows[0] || null);
}

export async function createConfig(config) {
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

export async function updateConfigById(id, config) {
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

export async function deleteConfig(id) {
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

export async function setPrimaryConfig(id) {
  await db.query('UPDATE webhook_config SET is_primary = false WHERE is_primary = true');
  const result = await db.query(
    'UPDATE webhook_config SET is_primary = true WHERE id = $1 RETURNING *',
    [id],
  );
  return maskConfig(result.rows[0]);
}
