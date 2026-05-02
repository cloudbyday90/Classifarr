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
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');
const classificationEvidenceService = require('./classificationEvidenceService');
const classificationEvidenceRepository = require('./classificationEvidenceRepository');
const { generateApiKey } = require('./apiKeyService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BackupService');

const BACKUP_VERSION = '2.0';
const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;

// Allowed columns for restore operations (whitelist for SQL injection prevention)
const RADARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add'];
const SONARR_ALLOWED_COLUMNS = ['name', 'url', 'api_key', 'is_active', 'quality_profile_id', 'root_folder_path', 'monitored', 'search_on_add', 'season_folder'];
const LIBRARY_ALLOWED_COLUMNS = ['name', 'type', 'media_server_id', 'external_id', 'is_active', 'sync_enabled'];
const ENCRYPTED_BACKUP_PASSWORD_ERROR = 'Password must be a string with at least 8 characters for encrypted backups';

function isValidEncryptedBackupPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

class BackupService {
  /**
   * Ensure backup directory exists
   */
  async ensureBackupDirectory() {
    try {
      await fs.mkdir(BACKUP_DIR, { recursive: true });
      logger.info('Backup directory ready', { path: BACKUP_DIR });
    } catch (error) {
      logger.error('Failed to create backup directory', { error: error.message });
      throw new Error('Failed to create backup directory');
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(data, password) {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(IV_LENGTH);

      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data), 'utf8'),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      // Combine salt + iv + authTag + encrypted data
      const result = Buffer.concat([salt, iv, authTag, encrypted]);
      return result.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', { error: error.message });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(encryptedData, password) {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');

      // Extract components
      const salt = buffer.slice(0, SALT_LENGTH);
      const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
      const authTag = buffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
      const encrypted = buffer.slice(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

      const key = this.deriveKey(password, salt);

      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      logger.error('Decryption failed', { error: error.message });
      throw new Error('Invalid password or corrupted backup file');
    }
  }

  /**
   * Collect all configuration data from database
   */
  async collectBackupData(options = {}) {
    const { includePatterns = true } = options;

    try {
      logger.info('Collecting backup data', { includePatterns });

      // Core configuration tables
      const [
        users,
        mediaServers,
        radarrConfigs,
        sonarrConfigs,
        libraries,
        libraryLabels,
        libraryPolicies,
        libraryCustomRules,
        labelPresets,
        scheduledTasks,
        confidenceSettings,
        autoLearnedPreferences,
        settings,
        ollamaConfig,
        tmdbConfig,
        omdbConfig,
        aiConfig,
        webhookConfig,
        pathMappings
      ] = await Promise.all([
        // Users (exclude API keys - they'll be regenerated)
        db.query('SELECT id, username, role, is_active, must_change_password, created_at FROM users ORDER BY id'),
        // Service connections
        db.query('SELECT id, type, name, url, api_key, is_active, created_at FROM media_server ORDER BY id'),
        db.query('SELECT * FROM radarr_config ORDER BY id'),
        db.query('SELECT * FROM sonarr_config ORDER BY id'),
        // Libraries and policies
        db.query('SELECT * FROM libraries ORDER BY id'),
        db.query('SELECT * FROM library_labels ORDER BY id'),
        db.query('SELECT * FROM library_policies ORDER BY id'),
        db.query('SELECT * FROM library_custom_rules ORDER BY id'),
        db.query('SELECT * FROM label_presets ORDER BY id'),
        db.query('SELECT * FROM scheduled_tasks ORDER BY id'),
        // Settings
        db.query('SELECT * FROM confidence_settings ORDER BY setting_key'),
        db.query('SELECT * FROM auto_learned_preferences WHERE status = $1 ORDER BY id', ['active']),
        db.query('SELECT * FROM settings ORDER BY id'),
        db.query('SELECT * FROM ollama_config LIMIT 1'),
        db.query('SELECT * FROM tmdb_config LIMIT 1'),
        db.query('SELECT * FROM omdb_config LIMIT 1'),
        db.query('SELECT * FROM ai_config LIMIT 1'),
        db.query('SELECT * FROM webhook_config LIMIT 1'),
        db.query('SELECT * FROM path_mappings ORDER BY id')
      ]);

      const backup = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          users: users.rows.map(u => ({ ...u, password_hash: '<excluded>' })),
          mediaServers: mediaServers.rows,
          radarrConfigs: radarrConfigs.rows,
          sonarrConfigs: sonarrConfigs.rows,
          libraries: libraries.rows,
          libraryLabels: libraryLabels.rows,
          libraryPolicies: libraryPolicies.rows,
          libraryCustomRules: libraryCustomRules.rows,
          labelPresets: labelPresets.rows,
          scheduledTasks: scheduledTasks.rows,
          confidenceSettings: confidenceSettings.rows,
          autoLearnedPreferences: autoLearnedPreferences.rows,
          settings: settings.rows,
          ollamaConfig: ollamaConfig.rows[0] || null,
          tmdbConfig: tmdbConfig.rows[0] || null,
          omdbConfig: omdbConfig.rows[0] || null,
          aiConfig: aiConfig.rows[0] || null,
          webhookConfig: webhookConfig.rows[0] || null,
          pathMappings: pathMappings.rows
        },
        meta: {
          usersCount: users.rows.length,
          mediaServersCount: mediaServers.rows.length,
          librariesCount: libraries.rows.length,
          customRulesCount: libraryCustomRules.rows.length,
          policiesCount: libraryPolicies.rows.length,
          autoLearnedCount: autoLearnedPreferences.rows.length
        }
      };

      if (includePatterns) {
        const learningPatterns = await classificationEvidenceService.listLegacyPatterns();
        backup.data.learningPatterns = learningPatterns;
        backup.meta.learningPatternsCount = learningPatterns.length;

        const classificationEvidence = await classificationEvidenceRepository.listAll();
        backup.data.classificationEvidence = classificationEvidence;
        backup.meta.classificationEvidenceCount = classificationEvidence.length;
      }

      logger.info('Backup data collected', backup.meta);
      return backup;
    } catch (error) {
      logger.error('Failed to collect backup data', { error: error.message });
      throw error;
    }
  }

  /**
   * Create backup file
   */
  async createBackup(options = {}) {
    const {
      encrypted = true,
      password = null,
      includePatterns = true
    } = options;

    if (encrypted && !isValidEncryptedBackupPassword(password)) {
      throw new Error(ENCRYPTED_BACKUP_PASSWORD_ERROR);
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

  /**
   * List all backups in directory
   */
  async listBackups() {
    await this.ensureBackupDirectory();

    try {
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
    } catch (error) {
      logger.error('Failed to list backups', { error: error.message });
      throw error;
    }
  }

  /**
   * Read and parse backup file
   */
  async readBackup(filename, password = null) {
    const filepath = path.join(BACKUP_DIR, filename);

    try {
      const fileContent = await fs.readFile(filepath, 'utf8');
      const parsed = JSON.parse(fileContent);

      if (parsed.encrypted) {
        if (!password) {
          throw new Error('Password required for encrypted backup');
        }
        return this.decrypt(parsed.data, password);
      }

      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Backup file not found');
      }
      logger.error('Failed to read backup', { filename, error: error.message });
      throw error;
    }
  }

  /**
   * Restore backup with replace or merge mode
   */
  async restoreBackup(filename, options = {}) {
    const {
      password = null,
      mode = 'replace'
    } = options;

    const backupData = await this.readBackup(filename, password);

    if (!backupData.version) {
      throw new Error('Invalid backup format');
    }

    logger.info('Starting restore', { filename, mode, version: backupData.version });

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      if (mode === 'replace') {
        await client.query('DELETE FROM library_custom_rules');
        await client.query('DELETE FROM library_labels');
        await client.query('DELETE FROM library_policies');
        await client.query('DELETE FROM auto_learned_preferences');
        await classificationEvidenceService.purgeAllLegacyPatterns({ client, actor: 'backup_restore', reason: 'replace_mode' });
        await classificationEvidenceRepository.purgeAll({ client });
        await client.query('DELETE FROM scheduled_tasks');
        await client.query('DELETE FROM path_mappings');
        await client.query('DELETE FROM label_presets');
        await client.query('DELETE FROM libraries WHERE id > 0');
        await client.query('DELETE FROM radarr_config');
        await client.query('DELETE FROM sonarr_config');
        await client.query('DELETE FROM media_server');
        logger.info('Cleared existing configuration');
      }

      if (backupData.data.confidenceSettings) {
        for (const setting of backupData.data.confidenceSettings) {
          await client.query(
            `INSERT INTO confidence_settings (setting_key, setting_value, description, default_value)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (setting_key) DO UPDATE SET
               setting_value = EXCLUDED.setting_value,
               description = EXCLUDED.description,
               default_value = EXCLUDED.default_value`,
            [setting.setting_key, setting.setting_value, setting.description, setting.default_value]
          );
        }
      }

      if (backupData.data.mediaServers) {
        for (const server of backupData.data.mediaServers) {
          await client.query(
            `INSERT INTO media_server (type, name, url, api_key, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (type, name) DO UPDATE SET
               url = EXCLUDED.url,
               api_key = EXCLUDED.api_key,
               is_active = EXCLUDED.is_active`,
            [server.type, server.name, server.url, server.api_key, server.is_active]
          );
        }
      }

      if (backupData.data.radarrConfigs) {
        for (const config of backupData.data.radarrConfigs) {
          const { id: _id, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = config;
          const keys = Object.keys(data).filter(key => RADARR_ALLOWED_COLUMNS.includes(key));
          const values = keys.map(key => data[key]);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          if (keys.length > 0) {
            const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
            await client.query(
              `INSERT INTO radarr_config (${keys.join(', ')}) VALUES (${placeholders})
               ON CONFLICT (name) DO UPDATE SET ${updateClauses}`,
              values
            );
          }
        }
      }

      if (backupData.data.sonarrConfigs) {
        for (const config of backupData.data.sonarrConfigs) {
          const { id: _id, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = config;
          const keys = Object.keys(data).filter(key => SONARR_ALLOWED_COLUMNS.includes(key));
          const values = keys.map(key => data[key]);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          if (keys.length > 0) {
            const updateClauses = keys.filter(k => k !== 'name').map(k => `${k} = EXCLUDED.${k}`).join(', ');
            await client.query(
              `INSERT INTO sonarr_config (${keys.join(', ')}) VALUES (${placeholders})
               ON CONFLICT (name) DO UPDATE SET ${updateClauses}`,
              values
            );
          }
        }
      }

      const libraryIdMap = new Map();
      if (backupData.data.libraries) {
        for (const library of backupData.data.libraries) {
          const { id: oldId, created_at: _created_at, updated_at: _updated_at, last_sync: _last_sync, ...data } = library;
          const keys = Object.keys(data).filter(key => LIBRARY_ALLOWED_COLUMNS.includes(key));
          const values = keys.map(key => data[key]);
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

          if (keys.length > 0) {
            const updateClauses = keys.filter(k => k !== 'name' && k !== 'type').map(k => `${k} = EXCLUDED.${k}`).join(', ');
            const result = await client.query(
              `INSERT INTO libraries (${keys.join(', ')}) VALUES (${placeholders})
               ON CONFLICT (name, media_type) DO UPDATE SET ${updateClauses}
               RETURNING id`,
              values
            );
            libraryIdMap.set(oldId, result.rows[0].id);
          }
        }
      }

      if (backupData.data.libraryPolicies) {
        for (const policy of backupData.data.libraryPolicies) {
          const newLibraryId = libraryIdMap.get(policy.library_id);
          if (!newLibraryId) continue;

          const { id: _id, library_id: _library_id, created_at: _created_at, updated_at: _updated_at, ...data } = policy;
          await client.query(
            `INSERT INTO library_policies (library_id, policy_type, policy_data, is_active)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (library_id, policy_type) DO UPDATE SET
               policy_data = EXCLUDED.policy_data,
               is_active = EXCLUDED.is_active`,
            [newLibraryId, data.policy_type, data.policy_data, data.is_active]
          );
        }
      }

      if (backupData.data.libraryCustomRules) {
        for (const rule of backupData.data.libraryCustomRules) {
          const newLibraryId = libraryIdMap.get(rule.library_id);
          if (!newLibraryId) continue;

          await client.query(
            `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (library_id, name) DO UPDATE SET
               description = EXCLUDED.description,
               rule_json = EXCLUDED.rule_json,
               is_active = EXCLUDED.is_active`,
            [newLibraryId, rule.name, rule.description, rule.rule_json, rule.is_active]
          );
        }
      }

      if (backupData.data.labelPresets) {
        for (const preset of backupData.data.labelPresets) {
          const { id: _id, created_at: _created_at, ...data } = preset;
          await client.query(
            `INSERT INTO label_presets (name, labels) VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET
               labels = EXCLUDED.labels`,
            [data.name, data.labels]
          );
        }
      }

      if (backupData.data.scheduledTasks) {
        for (const task of backupData.data.scheduledTasks) {
          const newLibraryId = task.library_id ? libraryIdMap.get(task.library_id) : null;
          await client.query(
            `INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (name, task_type) DO UPDATE SET
               library_id = EXCLUDED.library_id,
               interval_minutes = EXCLUDED.interval_minutes,
               enabled = EXCLUDED.enabled`,
            [task.name, task.task_type, newLibraryId, task.interval_minutes, task.enabled]
          );
        }
      }

      if (backupData.data.autoLearnedPreferences) {
        for (const pref of backupData.data.autoLearnedPreferences) {
          const newLibraryId = libraryIdMap.get(pref.library_id);
          if (!newLibraryId) continue;

          await client.query(
            `INSERT INTO auto_learned_preferences
             (library_id, policy_id, preference_type, preference_value, confidence_count, source, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (library_id, preference_type, preference_value) DO UPDATE SET
               policy_id = EXCLUDED.policy_id,
               confidence_count = EXCLUDED.confidence_count,
               source = EXCLUDED.source,
               status = EXCLUDED.status`,
            [newLibraryId, pref.policy_id, pref.preference_type, pref.preference_value,
             pref.confidence_count, pref.source, pref.status]
          );
        }
      }

      if (backupData.data.learningPatterns) {
        for (const pattern of backupData.data.learningPatterns) {
          const newLibraryId = libraryIdMap.get(pattern.library_id);
          if (!newLibraryId) continue;
          await classificationEvidenceService.restoreLegacyPattern({
            pattern,
            libraryId: newLibraryId,
            client
          });
        }
      }

      if (backupData.data.classificationEvidence) {
        for (const row of backupData.data.classificationEvidence) {
          const newLibraryId = row.library_id != null
            ? (libraryIdMap.get(row.library_id) ?? null)
            : null;
          await classificationEvidenceRepository.upsertEvidence(
            {
              scope: row.scope,
              tmdbId: row.tmdb_id ?? null,
              mediaType: row.media_type ?? null,
              libraryId: newLibraryId,
              evidenceKey: row.evidence_key ?? null,
              evidenceData: row.evidence_data ?? null,
              confidence: row.confidence ?? null,
              usageCount: row.usage_count ?? 0,
              successRate: row.success_rate ?? null,
              provenance: row.provenance,
              status: row.status ?? 'active',
              createdBy: row.created_by ?? null,
              sourceClassificationId: row.source_classification_id ?? null,
              sourceSystem: row.source_system ?? null
            },
            { client, conflictMode: 'do_nothing' }
          );
        }
      }

      if (backupData.data.pathMappings) {
        for (const mapping of backupData.data.pathMappings) {
          const { id: _id, created_at: _created_at, ...data } = mapping;
          await client.query(
            `INSERT INTO path_mappings (source_path, target_path, is_active)
             VALUES ($1, $2, $3)
             ON CONFLICT (source_path) DO UPDATE SET
               target_path = EXCLUDED.target_path,
               is_active = EXCLUDED.is_active`,
            [data.source_path, data.target_path, data.is_active]
          );
        }
      }

      if (backupData.data.ollamaConfig) {
        const config = backupData.data.ollamaConfig;
        await client.query(
          `INSERT INTO ollama_config (host, port, model)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             host = EXCLUDED.host,
             port = EXCLUDED.port,
             model = EXCLUDED.model`,
          [config.host, config.port, config.model]
        );
      }

      if (backupData.data.tmdbConfig) {
        const config = backupData.data.tmdbConfig;
        await client.query(
          `INSERT INTO tmdb_config (api_key)
           VALUES ($1)
           ON CONFLICT (id) DO UPDATE SET
             api_key = EXCLUDED.api_key`,
          [config.api_key]
        );
      }

      if (backupData.data.omdbConfig) {
        const config = backupData.data.omdbConfig;
        await client.query(
          `INSERT INTO omdb_config (api_key, is_active, daily_limit)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             api_key = EXCLUDED.api_key,
             is_active = EXCLUDED.is_active,
             daily_limit = EXCLUDED.daily_limit`,
          [config.api_key, config.is_active, config.daily_limit]
        );
      }

      if (backupData.data.aiConfig) {
        const config = backupData.data.aiConfig;
        await client.query(
          `INSERT INTO ai_config (provider, api_key, model, base_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             provider = EXCLUDED.provider,
             api_key = EXCLUDED.api_key,
             model = EXCLUDED.model,
             base_url = EXCLUDED.base_url`,
          [config.provider, config.api_key, config.model, config.base_url]
        );
      }

      if (backupData.data.webhookConfig) {
        const config = backupData.data.webhookConfig;
        const secretKey = config.secret_key ?? config.webhook_key ?? null;
        await client.query(
          `INSERT INTO webhook_config (id, secret_key, enabled)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             secret_key = EXCLUDED.secret_key,
             enabled = EXCLUDED.enabled`,
          [config.id || 1, secretKey, config.enabled]
        );
      }

      if (backupData.data.settings) {
        for (const setting of backupData.data.settings) {
          await client.query(
            `INSERT INTO settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET
               value = EXCLUDED.value`,
            [setting.key, setting.value]
          );
        }
      }

      if (backupData.data.libraryLabels) {
        for (const label of backupData.data.libraryLabels) {
          const newLibraryId = libraryIdMap.get(label.library_id);
          if (!newLibraryId) continue;

          await client.query(
            `INSERT INTO library_labels (library_id, label)
             VALUES ($1, $2)
             ON CONFLICT (library_id, label) DO NOTHING`,
            [newLibraryId, label.label]
          );
        }
      }

      const { key: newApiKey, keyHash: apiKeyHash, prefix: apiKeyPrefix } = generateApiKey();

      await client.query(
        `INSERT INTO api_keys (name, key_hash, key_prefix, permissions, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        ['Restored System API Key', apiKeyHash, apiKeyPrefix, 'admin', true]
      );

      await client.query('COMMIT');

      logger.info('Restore completed successfully', { filename, mode });

      return {
        success: true,
        newApiKey,
        stats: {
          librariesRestored: backupData.data.libraries?.length || 0,
          policiesRestored: backupData.data.libraryPolicies?.length || 0,
          rulesRestored: backupData.data.libraryCustomRules?.length || 0,
          patternsRestored: backupData.data.learningPatterns?.length || 0,
          classificationEvidenceRestored: backupData.data.classificationEvidence?.length || 0
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Restore failed', { filename, error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete backup file
   */
  async deleteBackup(filename) {
    const filepath = path.join(BACKUP_DIR, filename);

    try {
      await fs.unlink(filepath);
      logger.info('Backup deleted', { filename });
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Backup file not found');
      }
      logger.error('Failed to delete backup', { filename, error: error.message });
      throw error;
    }
  }

  /**
   * Log backup operation to audit trail
   */
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

module.exports = new BackupService();
module.exports.ENCRYPTED_BACKUP_PASSWORD_ERROR = ENCRYPTED_BACKUP_PASSWORD_ERROR;
module.exports.isValidEncryptedBackupPassword = isValidEncryptedBackupPassword;
