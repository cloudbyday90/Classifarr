/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const {
  encryptValue,
  decryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
  generateRandomKey,
  constantTimeCompare
} = require('../utils/encryption');
const { createLogger } = require('../utils/logger');

const logger = createLogger('apiKeyService');

const VALID_PERMISSIONS = ['read_only', 'read_write', 'webhook_only', 'embed_service', 'admin'];

function generateApiKey() {
  const key = generateRandomKey('clf_', 24);
  const { encrypted, iv, authTag } = encryptValue(key);
  const keyHash = formatEncryptedValue(encrypted, iv, authTag);
  const prefix = key.substring(0, 8);

  return { key, encrypted, iv, authTag, prefix, keyHash };
}

async function createApiKey(name = 'API Key', permissions = 'read_write', expiresAt = null) {
  if (!VALID_PERMISSIONS.includes(permissions)) {
    throw new Error(`Invalid permissions. Must be one of: ${VALID_PERMISSIONS.join(', ')}`);
  }

  const { key, keyHash, prefix } = generateApiKey();

  const result = await db.query(
    `INSERT INTO api_keys (name, key_hash, key_prefix, permissions, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, key_prefix, permissions, created_at, expires_at, is_active`,
    [name, keyHash, prefix, permissions, expiresAt]
  );

  return {
    ...result.rows[0],
    key,
  };
}

async function createEmbeddingServiceApiKey(name = 'Embedding Service API Key', expiresAt = null) {
  return createApiKey(name, 'embed_service', expiresAt);
}

async function validateApiKey(key) {
  if (typeof key !== 'string' || !key.startsWith('clf_')) {
    return null;
  }

  const prefix = key.substring(0, 8);
  const result = await db.query(
    `SELECT id, name, key_prefix, key_hash, permissions, created_at, last_used_at,
            last_used_ip, is_active, expires_at
     FROM api_keys
     WHERE key_prefix = $1 AND is_active = true`,
    [prefix]
  );

  for (const row of result.rows) {
    try {
      const { encrypted, iv, authTag } = parseEncryptedValue(row.key_hash);
      const decryptedKey = decryptValue(encrypted, iv, authTag);

      if (constantTimeCompare(decryptedKey, key)) {
        const apiKey = { ...row };
        delete apiKey.key_hash;

        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
          return null;
        }

        return apiKey;
      }
    } catch (error) {
      logger.warn(
        'WARNING: Failed to decrypt stored API key with id %s. ' +
        'This may indicate an invalid API_KEY_ENCRYPTION_KEY or data corruption: %s',
        row.id,
        error && error.message ? error.message : String(error)
      );
    }
  }

  return null;
}

async function updateLastUsed(id, ip) {
  await db.query(
    `UPDATE api_keys
     SET last_used_at = NOW(), last_used_ip = $1
     WHERE id = $2`,
    [ip, id]
  );
}

async function listApiKeys() {
  const result = await db.query(
    `SELECT id, name, key_prefix, permissions, created_at, last_used_at,
            last_used_ip, is_active, expires_at
     FROM api_keys
     ORDER BY created_at DESC`
  );

  return result.rows;
}

async function getApiKeyById(id) {
  const result = await db.query(
    `SELECT id, name, key_prefix, permissions, created_at, last_used_at,
            last_used_ip, is_active, expires_at
     FROM api_keys
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function getApiKeyFull(id) {
  const result = await db.query(
    `SELECT key_hash FROM api_keys WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  try {
    const { encrypted, iv, authTag } = parseEncryptedValue(result.rows[0].key_hash);
    return decryptValue(encrypted, iv, authTag);
  } catch (error) {
    logger.error('Failed to decrypt API key:', { error: error.message });
    return null;
  }
}

async function updateApiKey(id, updates) {
  const allowedFields = ['name', 'is_active', 'permissions'];
  const fields = [];
  const values = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      if (key === 'permissions' && !VALID_PERMISSIONS.includes(value)) {
        throw new Error(`Invalid permissions. Must be one of: ${VALID_PERMISSIONS.join(', ')}`);
      }
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return null;
  }

  values.push(id);

  const result = await db.query(
    `UPDATE api_keys
     SET ${fields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING id, name, key_prefix, permissions, created_at, last_used_at,
               last_used_ip, is_active, expires_at`,
    values
  );

  return result.rows[0] || null;
}

async function deleteApiKey(id) {
  const result = await db.query(
    'DELETE FROM api_keys WHERE id = $1',
    [id]
  );

  return result.rowCount > 0;
}

async function hasApiKeys() {
  const result = await db.query('SELECT COUNT(*) FROM api_keys');
  return parseInt(result.rows[0].count) > 0;
}

async function ensureDefaultApiKey() {
  const exists = await hasApiKeys();

  if (!exists) {
    await createApiKey('Default API Key', 'read_write');

    logger.info('✓ Auto-generated default API key');
    logger.info('  View in Settings → Security after logging in');

    return null;
  }

  return null;
}

async function logAudit(apiKeyId, action, options = {}) {
  const { endpoint, ipAddress, userAgent } = options;

  try {
    await db.query(
      `INSERT INTO api_key_audit (api_key_id, action, endpoint, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [apiKeyId, action, endpoint || null, ipAddress || null, userAgent || null]
    );
  } catch (error) {
    logger.error('Failed to log API key audit:', { error: error.message });
  }
}

const apiKeyService = {
  generateApiKey,
  createApiKey,
  createEmbeddingServiceApiKey,
  validateApiKey,
  updateLastUsed,
  listApiKeys,
  getApiKeyById,
  getApiKeyFull,
  updateApiKey,
  deleteApiKey,
  hasApiKeys,
  ensureDefaultApiKey,
  logAudit,
  VALID_PERMISSIONS,
};

module.exports = apiKeyService;
