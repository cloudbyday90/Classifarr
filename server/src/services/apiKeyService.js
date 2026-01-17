/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const crypto = require('crypto');
const db = require('../config/database');

// Encryption settings for API keys
// NOTE: We use encryption (not hashing) so authenticated users can view their keys again
// This is different from password hashing - API keys need to be retrievable
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

// IMPORTANT: Set API_KEY_ENCRYPTION_KEY in environment for production
// If not set, a random key will be generated on each restart, making old keys unrecoverable
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn('WARNING: API_KEY_ENCRYPTION_KEY not set in environment!');
  console.warn('Using a random key - all API keys will become invalid on server restart.');
  console.warn('Set API_KEY_ENCRYPTION_KEY to a 64-character hex string to persist keys.');
}

const ENCRYPTION_KEY_BYTES = ENCRYPTION_KEY 
  ? Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex')
  : crypto.randomBytes(32);

/**
 * Encrypt an API key for secure storage
 * @param {string} key - The plaintext API key
 * @returns {Object} { encrypted, iv, authTag }
 */
function encryptApiKey(key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY_BYTES,
    iv
  );
  
  let encrypted = cipher.update(key, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypt an API key from storage
 * @param {string} encrypted - The encrypted key
 * @param {string} iv - The initialization vector
 * @param {string} authTag - The authentication tag
 * @returns {string} The plaintext API key
 */
function decryptApiKey(encrypted, iv, authTag) {
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY_BYTES,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a new API key with secure encryption
 * NOTE: We store encrypted keys (not hashed) so users can view them again when logged in
 * @returns {Object} { key, encrypted, iv, authTag, prefix }
 */
function generateApiKey() {
  const randomBytes = crypto.randomBytes(24);
  const key = `clf_${randomBytes.toString('base64url')}`;
  const { encrypted, iv, authTag } = encryptApiKey(key);
  const prefix = key.substring(0, 8);
  
  return { key, encrypted, iv, authTag, prefix };
}

/**
 * Create a new API key
 * @param {string} name - Name for the API key
 * @param {string} permissions - Permission level (read_only or read_write)
 * @param {Date|null} expiresAt - Optional expiration date
 * @returns {Promise<Object>} Created API key with plaintext key
 * NOTE: Key is encrypted in database so it can be retrieved later by authenticated users
 */
async function createApiKey(name = 'API Key', permissions = 'read_write', expiresAt = null) {
  const { key, encrypted, iv, authTag, prefix } = generateApiKey();
  
  // Store encrypted key with IV and auth tag
  // Format: encrypted$iv$authTag (using $ as separator)
  const keyHash = `${encrypted}$${iv}$${authTag}`;
  
  const result = await db.query(
    `INSERT INTO api_keys (name, key_hash, key_prefix, permissions, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, key_prefix, permissions, created_at, expires_at, is_active`,
    [name, keyHash, prefix, permissions, expiresAt]
  );
  
  return {
    ...result.rows[0],
    key, // Full key returned on creation and can be retrieved later
  };
}

/**
 * Validate an API key and return key details
 * @param {string} key - The API key to validate
 * @returns {Promise<Object|null>} Key details if valid, null otherwise
 */
async function validateApiKey(key) {
  if (!key || !key.startsWith('clf_')) {
    return null;
  }
  
  // Get all active keys with matching prefix (for performance)
  const prefix = key.substring(0, 8);
  const result = await db.query(
    `SELECT id, name, key_prefix, key_hash, permissions, created_at, last_used_at, 
            last_used_ip, is_active, expires_at
     FROM api_keys
     WHERE key_prefix = $1 AND is_active = true`,
    [prefix]
  );
  
  // Try to decrypt and match each key
  for (const row of result.rows) {
    try {
      const [encrypted, iv, authTag] = row.key_hash.split('$');
      const decryptedKey = decryptApiKey(encrypted, iv, authTag);
      
      if (decryptedKey === key) {
        // Found matching key
        const apiKey = { ...row };
        delete apiKey.key_hash; // Don't expose encrypted data
        
        // Check if key is expired
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
          return null;
        }
        
        return apiKey;
      }
    } catch (error) {
      // Decryption failed, try next key
      continue;
    }
  }
  
  return null;
}

/**
 * Update last used timestamp and IP address
 * @param {number} id - API key ID
 * @param {string} ip - IP address
 */
async function updateLastUsed(id, ip) {
  await db.query(
    `UPDATE api_keys
     SET last_used_at = NOW(), last_used_ip = $1
     WHERE id = $2`,
    [ip, id]
  );
}

/**
 * List all API keys (without hashes)
 * @returns {Promise<Array>} List of API keys
 */
async function listApiKeys() {
  const result = await db.query(
    `SELECT id, name, key_prefix, permissions, created_at, last_used_at, 
            last_used_ip, is_active, expires_at
     FROM api_keys
     ORDER BY created_at DESC`
  );
  
  return result.rows;
}

/**
 * Get a specific API key by ID (without the full key)
 * @param {number} id - API key ID
 * @returns {Promise<Object|null>} API key details or null
 */
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

/**
 * Get the full decrypted API key by ID (for authenticated users only)
 * NOTE: This allows users to view their API keys again when logged into the system
 * This is intentional - users need to be able to retrieve keys they may have lost
 * @param {number} id - API key ID
 * @returns {Promise<string|null>} Decrypted API key or null
 */
async function getApiKeyFull(id) {
  const result = await db.query(
    `SELECT key_hash FROM api_keys WHERE id = $1`,
    [id]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  try {
    const [encrypted, iv, authTag] = result.rows[0].key_hash.split('$');
    return decryptApiKey(encrypted, iv, authTag);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

/**
 * Update API key metadata
 * @param {number} id - API key ID
 * @param {Object} updates - Fields to update (name, is_active)
 * @returns {Promise<Object|null>} Updated API key or null
 */
async function updateApiKey(id, updates) {
  const allowedFields = ['name', 'is_active'];
  const fields = [];
  const values = [];
  let paramCount = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
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

/**
 * Delete (revoke) an API key
 * @param {number} id - API key ID
 * @returns {Promise<boolean>} True if deleted, false otherwise
 */
async function deleteApiKey(id) {
  const result = await db.query(
    'DELETE FROM api_keys WHERE id = $1',
    [id]
  );
  
  return result.rowCount > 0;
}

/**
 * Check if any API keys exist
 * @returns {Promise<boolean>} True if any keys exist
 */
async function hasApiKeys() {
  const result = await db.query('SELECT COUNT(*) FROM api_keys');
  return parseInt(result.rows[0].count) > 0;
}

/**
 * Auto-generate default API key on first run
 */
async function ensureDefaultApiKey() {
  const exists = await hasApiKeys();
  
  if (!exists) {
    const key = await createApiKey('Default API Key', 'read_write');
    console.log('✓ Auto-generated default API key');
    console.log(`  Prefix: ${key.key_prefix}...`);
    // NOTE: Full key is logged here for initial setup only
    // Users can retrieve it later via Settings → Security
    console.log(`  Full key: ${key.key}`);
    console.log('  You can view this key again in Settings → Security');
    return key;
  }
  
  return null;
}

module.exports = {
  generateApiKey,
  createApiKey,
  validateApiKey,
  updateLastUsed,
  listApiKeys,
  getApiKeyById,
  getApiKeyFull, // NEW: Retrieve full decrypted key for authenticated users
  updateApiKey,
  deleteApiKey,
  hasApiKeys,
  ensureDefaultApiKey,
};
