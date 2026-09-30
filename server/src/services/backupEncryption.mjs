import { ValidationError } from '../utils/appError.mjs';
import { createLogger } from '../utils/logger.mjs';
import { encryptBackupPayload, decryptBackupPayload } from './backupCipher.mjs';

const logger = createLogger('BackupEncryption');

export { deriveKey } from './backupCipher.mjs';

export function encrypt(data, password) {
  try {
    return encryptBackupPayload(data, password);
  } catch {
    logger.error('Encryption failed');
    throw new Error('Encryption failed');
  }
}

export function decrypt(encryptedData, password) {
  try {
    return decryptBackupPayload(encryptedData, password);
  } catch {
    // A JSON parser error can contain decrypted content. Never log its message.
    logger.error('Decryption failed');
    throw new ValidationError('Invalid password or corrupted backup file');
  }
}
