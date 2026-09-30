/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// Keep the existing portable backup format. No logging, database or runtime imports.
export const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
export const PBKDF2_ITERATIONS = 100000;
export const SALT_LENGTH = 32;
export const IV_LENGTH = 16;
export const KEY_LENGTH = 32;
export const AUTH_TAG_LENGTH = 16;

export function deriveKey(password, salt) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encryptBackupPayload(data, password) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, deriveKey(password, salt), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

export function decryptBackupPayload(data, password) {
  const buffer = Buffer.from(data, 'base64');
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tagEnd = SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, deriveKey(password, salt), iv);
  decipher.setAuthTag(buffer.subarray(SALT_LENGTH + IV_LENGTH, tagEnd));
  const plaintext = Buffer.concat([decipher.update(buffer.subarray(tagEnd)), decipher.final()]);
  try { return JSON.parse(plaintext.toString('utf8')); }
  finally { plaintext.fill(0); }
}
