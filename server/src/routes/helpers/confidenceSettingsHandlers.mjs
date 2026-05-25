/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildConfidenceExportResponse,
  buildConfidenceSettingsResponse,
  normalizeConfidenceHistoryPagination,
  normalizeConfidenceSettingsImportRequest,
  normalizeConfidenceSettingsUpdateRequest,
} from './confidenceSettingsSupport.mjs';
import { createSettingsServiceError } from '../../services/shared/settingsServiceErrors.mjs';
import { ValidationError } from '../../utils/appError.mjs';

function clearAutoLearningCache(logger, autoLearningService) {
  if (!autoLearningService?.clearCache) {
    return;
  }

  try {
    autoLearningService.clearCache();
  } catch (err) {
    logger.warn('Could not clear autoLearningService cache', { error: err.message });
  }
}

export function createConfidenceSettingsHandlers({ db, logger, autoLearningService }) {
  const deprecatedKeys = ['discord_auto_route_threshold', 'discord_verify_threshold', 'discord_enhanced_details_threshold'];

  return {
    async getSettings(_req, res) {
      const result = await db.query(`
        SELECT setting_key, setting_value, description, default_value
        FROM confidence_settings
        ORDER BY setting_key
      `);

      return res.json(buildConfidenceSettingsResponse(result.rows));
    },

    async updateSettings(req, res) {
      const normalizedRequest = normalizeConfidenceSettingsUpdateRequest(req.body);
      const userId = req.user?.id || null;

      if (normalizedRequest.errorResponse) {
        throw new ValidationError(normalizedRequest.errorResponse.body.error);
      }

      const updates = normalizedRequest.payload;

      await db.withTransaction(async (client) => {
        const changeReason = typeof updates._reason === 'string' && updates._reason.trim()
          ? updates._reason.trim()
          : 'Manual update';

        const sentDeprecatedKeys = deprecatedKeys.filter((key) => key in updates);
        if (sentDeprecatedKeys.length > 0) {
          logger.warn('Deprecated Discord threshold settings sent - these are ignored', {
            deprecatedKeys: sentDeprecatedKeys,
            userId,
          });
        }

        const existingKeys = await client.query('SELECT setting_key FROM confidence_settings');
        const validKeys = new Set(existingKeys.rows.map((row) => row.setting_key));

        for (const [key, newValue] of Object.entries(updates)) {
          if (key.startsWith('_')) {
            continue;
          }
          if (deprecatedKeys.includes(key)) {
            continue;
          }

          if (!validKeys.has(key)) {
            throw createSettingsServiceError(`Unknown confidence setting key: ${key}`, 400);
          }

          if (newValue === null || newValue === undefined) {
            throw createSettingsServiceError(`Invalid value for setting: ${key}`, 400);
          }

          const current = await client.query(
            'SELECT setting_value FROM confidence_settings WHERE setting_key = $1 FOR UPDATE',
            [key]
          );
          const oldValue = current.rows[0]?.setting_value;

          const updateResult = await client.query(`
            UPDATE confidence_settings
            SET setting_value = $1, updated_at = NOW()
            WHERE setting_key = $2
          `, [newValue.toString(), key]);

          if (updateResult.rowCount === 0) {
            throw new Error(`Failed to update setting: ${key}`);
          }

          await client.query(`
            INSERT INTO confidence_settings_audit
            (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [key, oldValue, newValue.toString(), userId, changeReason, req.ip]);
        }
      });

      clearAutoLearningCache(logger, autoLearningService);

      logger.info('Confidence settings updated', {
        userId,
        changesCount: Object.keys(updates).filter((key) => !key.startsWith('_')).length,
      });

      return res.json({ success: true, message: 'Settings updated successfully' });
    },

    async getHistory(req, res) {
      const MAX_LIMIT = 1000;

      const normalizedPagination = normalizeConfidenceHistoryPagination(req.query, MAX_LIMIT);
      if (normalizedPagination.errorResponse) {
        throw new ValidationError(normalizedPagination.errorResponse.body.error);
      }

      const { limit, offset } = normalizedPagination.payload;

      const result = await db.query(`
        SELECT 
          csa.*,
          u.username as changed_by_username
        FROM confidence_settings_audit csa
        LEFT JOIN users u ON csa.changed_by = u.id
        ORDER BY csa.changed_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return res.json(result.rows);
    },

    async revertSetting(req, res) {
      const { auditId } = req.params;
      const userId = req.user?.id || null;

      await db.withTransaction(async (client) => {
        const auditResult = await client.query(
          'SELECT * FROM confidence_settings_audit WHERE id = $1',
          [auditId]
        );

        if (auditResult.rows.length === 0) {
          throw createSettingsServiceError('Audit entry not found', 404);
        }

        const audit = auditResult.rows[0];
        const updateResult = await client.query(`
          UPDATE confidence_settings
          SET setting_value = $1, updated_at = NOW()
          WHERE setting_key = $2
        `, [audit.old_value, audit.setting_key]);

        if (updateResult.rowCount === 0) {
          throw createSettingsServiceError(`Setting not found: ${audit.setting_key}`, 404);
        }

        await client.query(`
          INSERT INTO confidence_settings_audit
          (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          audit.setting_key,
          audit.new_value,
          audit.old_value,
          userId,
          `Reverted from audit entry ${auditId}`,
          req.ip,
        ]);
      });

      clearAutoLearningCache(logger, autoLearningService);

      logger.info('Setting reverted successfully', {
        auditId,
        userId,
      });

      return res.json({ success: true, message: 'Setting reverted successfully' });
    },

    async exportSettings(req, res) {
      const result = await db.query('SELECT * FROM confidence_settings');
      return res.json(buildConfidenceExportResponse(result.rows, req.user?.username || 'unknown'));
    },

    async importSettings(req, res) {
      const normalizedRequest = normalizeConfidenceSettingsImportRequest(req.body?.settings);
      const userId = req.user?.id || null;

      if (normalizedRequest.errorResponse) {
        throw new ValidationError(normalizedRequest.errorResponse.body.error);
      }

      const settings = normalizedRequest.payload;

      await db.withTransaction(async (client) => {
        const existingKeys = await client.query('SELECT setting_key FROM confidence_settings');
        const validKeys = new Set(existingKeys.rows.map((row) => row.setting_key));

        for (const setting of settings) {
          if (!setting.setting_key || !validKeys.has(setting.setting_key)) {
            throw createSettingsServiceError(`Invalid or unknown setting key: ${setting.setting_key}`, 400);
          }

          if (setting.setting_value === null || setting.setting_value === undefined) {
            throw createSettingsServiceError(`Invalid value for setting: ${setting.setting_key}`, 400);
          }
        }

        for (const setting of settings) {
          const current = await client.query(
            'SELECT setting_value FROM confidence_settings WHERE setting_key = $1',
            [setting.setting_key]
          );

          const oldValue = current.rows[0]?.setting_value;

          await client.query(`
            UPDATE confidence_settings
            SET setting_value = $1, updated_at = NOW()
            WHERE setting_key = $2
          `, [setting.setting_value, setting.setting_key]);

          await client.query(`
            INSERT INTO confidence_settings_audit
            (setting_key, old_value, new_value, changed_by, change_reason, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            setting.setting_key,
            oldValue,
            setting.setting_value,
            userId,
            'Imported from configuration file',
            req.ip,
          ]);
        }
      });

      clearAutoLearningCache(logger, autoLearningService);

      logger.info('Settings imported successfully', {
        userId,
        settingsCount: settings.length,
      });

      return res.json({ success: true, message: 'Settings imported successfully' });
    },
  };
}

