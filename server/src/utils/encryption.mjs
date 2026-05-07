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

/* eslint-disable security/detect-non-literal-fs-filename */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY;
const ENCRYPTION_KEY_FILE = process.env.API_KEY_ENCRYPTION_KEY_FILE || '/app/data/secrets/api_key_encryption_key';

let ENCRYPTION_KEY_BYTES;

function isValidHexKey(key) {
  return typeof key === 'string' && key.length === 64 && /^[0-9a-fA-F]+$/.test(key);
}

function tryReadKeyFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const fileValue = fs.readFileSync(filePath, 'utf8').trim();
    if (!isValidHexKey(fileValue)) {
      // eslint-disable-next-line no-console
      console.warn('WARNING: API encryption key file exists but is invalid. Ignoring file value.');
      return null;
    }
    return fileValue;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`WARNING: Failed to read API encryption key file (${filePath}): ${error.message}`);
    return null;
  }
}

function tryPersistKeyToFile(filePath, key) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `${key}\n`, { mode: 0o600 });
      return true;
    }
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`WARNING: Failed to persist API encryption key file (${filePath}): ${error.message}`);
    return false;
  }
}

if (!ENCRYPTION_KEY) {
  const fileKey = tryReadKeyFromFile(ENCRYPTION_KEY_FILE);
  if (fileKey) {
    ENCRYPTION_KEY_BYTES = Buffer.from(fileKey, 'hex');
  } else {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    const persisted = tryPersistKeyToFile(ENCRYPTION_KEY_FILE, generatedKey);
    // eslint-disable-next-line no-console
    console.warn('WARNING: API_KEY_ENCRYPTION_KEY not set in environment!');
    if (persisted) {
      // eslint-disable-next-line no-console
      console.warn(`Persisted generated encryption key to ${ENCRYPTION_KEY_FILE}.`);
      // eslint-disable-next-line no-console
      console.warn('For explicit control, set API_KEY_ENCRYPTION_KEY to this value in your environment.');
    } else {
      // eslint-disable-next-line no-console
      console.warn('Using a temporary in-memory key - encrypted values may become invalid on restart.');
    }
    ENCRYPTION_KEY_BYTES = Buffer.from(generatedKey, 'hex');
  }
} else if (!isValidHexKey(ENCRYPTION_KEY)) {
  const msg = 'API_KEY_ENCRYPTION_KEY must be a 64-character hex string.';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(msg);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`WARNING: ${msg}`);
    const fallbackKey = crypto.randomBytes(32).toString('hex');
    const persisted = tryPersistKeyToFile(ENCRYPTION_KEY_FILE, fallbackKey);
    if (persisted) {
      // eslint-disable-next-line no-console
      console.warn(`Persisted generated fallback encryption key to ${ENCRYPTION_KEY_FILE}.`);
    } else {
      // eslint-disable-next-line no-console
      console.warn('Falling back to a temporary in-memory key - encrypted values may become invalid on restart.');
    }
    ENCRYPTION_KEY_BYTES = Buffer.from(fallbackKey, 'hex');
  }
} else {
  ENCRYPTION_KEY_BYTES = Buffer.from(ENCRYPTION_KEY, 'hex');
}

function encryptValue(value) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    ENCRYPTION_KEY_BYTES,
    iv
  );

  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decryptValue(encrypted, iv, authTag) {
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

function formatEncryptedValue(encrypted, iv, authTag) {
  return `${encrypted}$${iv}$${authTag}`;
}

function parseEncryptedValue(formatted) {
  const parts = formatted.split('$');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  return {
    encrypted: parts[0],
    iv: parts[1],
    authTag: parts[2],
  };
}

function generateRandomKey(prefix, byteLength = 24) {
  const randomBytes = crypto.randomBytes(byteLength);
  const key = `${prefix}${randomBytes.toString('base64url')}`;
  return key;
}

function maskKey(key, visibleChars = 8) {
  if (!key) return '';
  const prefix = key.substring(0, visibleChars);
  const masked = '••••••••';
  return `${prefix}${masked}`;
}

function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export { encryptValue, decryptValue, formatEncryptedValue, parseEncryptedValue, generateRandomKey, maskKey, constantTimeCompare };
