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
import { promises as fs } from 'node:fs';
import { ValidationError } from '../utils/appError.mjs';
import path from 'node:path';
import * as db from '../config/database.mjs';
import { collectBackupSnapshot } from './backupSnapshot.mjs';
import { createLogger } from '../utils/logger.mjs';
import { withServiceCatch } from '../utils/serviceCatch.mjs';
import { deriveKey as _deriveKey, encrypt as _encrypt, decrypt as _decrypt } from './backupEncryption.mjs';
import { executeBackupRestore } from './backupRestoreExecution.mjs';
import { withBackupRestoreSession } from './backupRestoreSession.mjs';
import { generateApiKey } from './apiKeyService.mjs';
import {
  nativeIntentReconciliationLifecycleService,
} from './nativeIntentReconciliationLifecycleService.mjs';
import {
  insertPolicyBackupRestoreVerification,
} from './policyBackupRestoreVerificationPersistence.mjs';

const logger = createLogger('BackupService');

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups';

export const ENCRYPTED_BACKUP_PASSWORD_ERROR = 'Password must be a string with at least 8 characters for encrypted backups';

export function isValidEncryptedBackupPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

export class BackupService {
  constructor({
    reconciliationLifecycle = nativeIntentReconciliationLifecycleService,
    recordBackupRestoreVerification = insertPolicyBackupRestoreVerification,
    restoreSession = withBackupRestoreSession,
  } = {}) {
    this.isValidEncryptedBackupPassword = isValidEncryptedBackupPassword;
    this.ENCRYPTED_BACKUP_PASSWORD_ERROR = ENCRYPTED_BACKUP_PASSWORD_ERROR;
    this.reconciliationLifecycle = reconciliationLifecycle;
    this.recordBackupRestoreVerification = recordBackupRestoreVerification;
    this.restoreSession = restoreSession;
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      logger.info('Backup directory ready', { path: BACKUP_DIR });
    } catch (error) {
      logger.error('Failed to create backup directory', { error: error.message });
      throw new Error('Failed to create backup directory');
    }
  }

  deriveKey(password, salt) {
    return _deriveKey(password, salt);
  }

  encrypt(data, password) {
    return _encrypt(data, password);
  }

  decrypt(encryptedData, password) {
    return _decrypt(encryptedData, password);
  }

  async collectBackupData(options = {}) {
    const { includePatterns = true } = options;
    return withServiceCatch(logger, 'Failed to collect backup data', async () => {
      logger.info('Collecting backup data', { includePatterns });
      const backup = await collectBackupSnapshot({ includePatterns });
      logger.info('Backup data collected', backup.meta);
      return backup;
    });
  }

  async createBackup(options = {}) {
    const {
      encrypted = true,
      password = null,
      includePatterns = true
    } = options;

    if (encrypted && !isValidEncryptedBackupPassword(password)) {
      throw new ValidationError(ENCRYPTED_BACKUP_PASSWORD_ERROR);
    }

    await this.ensureBackupDirectory();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = encrypted ? '.enc.json' : '.json';
    const filename = `classifarr_config_${timestamp}${extension}`;
    const filepath = path.join(BACKUP_DIR, filename);

    const backupData = await this.collectBackupData({ includePatterns });

    let fileContent;
    if (encrypted) {
      const encryptedData = this.encrypt(backupData, password);
      fileContent = JSON.stringify({
        encrypted: true,
        data: encryptedData
      }, null, 2);
    } else {
      fileContent = JSON.stringify(backupData, null, 2);
    }

    await fs.writeFile(filepath, fileContent, 'utf8');

    const stats = await fs.stat(filepath);

    logger.info('Backup created', {
      filename,
      size: stats.size,
      encrypted,
      includePatterns
    });

    return {
      filename,
      filepath,
      size: stats.size,
      encrypted,
      timestamp: new Date().toISOString()
    };
  }

  async listBackups() {
    await this.ensureBackupDirectory();

    return withServiceCatch(logger, 'Failed to list backups', async () => {
      const files = await fs.readdir(BACKUP_DIR);
      const backupFiles = files.filter(f =>
        f.startsWith('classifarr_config_') && (f.endsWith('.json') || f.endsWith('.enc.json'))
      );

      const backups = await Promise.all(
        backupFiles.map(async (filename) => {
          const filepath = path.join(BACKUP_DIR, filename);
          const stats = await fs.stat(filepath);
          const encrypted = filename.endsWith('.enc.json');

          return {
            filename,
            type: encrypted ? 'encrypted' : 'plaintext',
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
      );

      backups.sort((a, b) => b.createdAt - a.createdAt);

      return backups;
    });
  }

  async readBackup(filename, password = null) {
    const filepath = path.join(BACKUP_DIR, filename);

    return withServiceCatch(logger, 'Failed to read backup', { filename }, async () => {
      const fileContent = await fs.readFile(filepath, 'utf8');
      const parsed = JSON.parse(fileContent);

      if (parsed.encrypted) {
        if (!password) {
          throw new ValidationError('Password required for encrypted backup');
        }
        return this.decrypt(parsed.data, password);
      }

      return parsed;
    });
  }

  async restoreBackup(filename, options = {}) {
    const {
      password = null,
      mode = 'replace'
    } = options;

    const backupData = await this.readBackup(filename, password);

    if (!backupData.version) {
      throw new ValidationError('Invalid backup format');
    }

    logger.info('Starting restore', { filename, mode, version: backupData.version });

    return withServiceCatch(logger, 'Restore failed', { filename }, async () => {
      const result = await this.restoreSession({ database: db, logger }, database =>
        executeBackupRestore({
          database,
          lifecycle: this.reconciliationLifecycle,
          recordVerification: this.recordBackupRestoreVerification,
          createSystemApiKey: generateApiKey,
          backupData,
          mode,
          logger,
        }));
      logger.info('Restore completed successfully', { filename, mode });
      return result;
    });
  }

  async deleteBackup(filename) {
    const filepath = path.join(BACKUP_DIR, filename);

    return withServiceCatch(logger, 'Failed to delete backup', { filename }, async () => {
      await fs.unlink(filepath);
      logger.info('Backup deleted', { filename });
      return { success: true };
    });
  }

  async logAudit(operation, backupType, filename, status, options = {}) {
    try {
      const { userId, ipAddress, error, metadata, fileSize } = options;

      await db.query(
        `INSERT INTO backup_audit
         (operation, backup_type, filename, file_size, status, error_message, user_id, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [operation, backupType, filename, fileSize || null, status, error || null,
         userId || null, ipAddress || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (error) {
      logger.error('Failed to log audit', { error: error.message });
    }
  }
}

export const backupService = new BackupService();
