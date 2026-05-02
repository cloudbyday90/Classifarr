/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

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
      try {
        const result = await db.query(`
          SELECT setting_key, setting_value, description, default_value
          FROM confidence_settings
          ORDER BY setting_key
        `);

        const settings = result.rows.reduce((acc, row) => {
          acc[row.setting_key] = {
            value: row.setting_value,
            description: row.description,
            default: row.default_value,
          };
          return acc;
        }, {});

        return res.json(settings);
      } catch (error) {
        logger.error('Failed to get confidence settings', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve settings' });
      }
    },

    async updateSettings(req, res) {
      const client = await db.pool.connect();

      try {
        await client.query('BEGIN');

        const updates = req.body;
        const userId = req.user?.id || null;

        if (!isPlainObject(updates)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Settings must be a valid object' });
        }

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
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Unknown confidence setting key: ${key}` });
          }

          if (newValue === null || newValue === undefined) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Invalid value for setting: ${key}` });
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

        await client.query('COMMIT');

        clearAutoLearningCache(logger, autoLearningService);

        logger.info('Confidence settings updated', {
          userId,
          changesCount: Object.keys(updates).filter((key) => !key.startsWith('_')).length,
        });

        return res.json({ success: true, message: 'Settings updated successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to update confidence settings', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
        });
        return res.status(500).json({ error: 'Failed to update settings' });
      } finally {
        client.release();
      }
    },

    async getHistory(req, res) {
      try {
        const rawLimit = req.query.limit;
        const rawOffset = req.query.offset;

        const limit = rawLimit === undefined ? 50 : parseInt(rawLimit, 10);
        const offset = rawOffset === undefined ? 0 : parseInt(rawOffset, 10);
        const MAX_LIMIT = 1000;

        if (
          !Number.isInteger(limit) ||
          !Number.isInteger(offset) ||
          limit <= 0 ||
          limit > MAX_LIMIT ||
          offset < 0
        ) {
          return res.status(400).json({
            error: `Invalid pagination parameters. 'limit' must be a positive integer up to ${MAX_LIMIT}, and 'offset' must be a non-negative integer.`,
          });
        }

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
      } catch (error) {
        logger.error('Failed to retrieve confidence settings history', { error: error.message });
        return res.status(500).json({ error: 'Failed to retrieve history' });
      }
    },

    async revertSetting(req, res) {
      const client = await db.pool.connect();

      try {
        await client.query('BEGIN');

        const { auditId } = req.params;
        const userId = req.user?.id || null;

        const auditResult = await client.query(
          'SELECT * FROM confidence_settings_audit WHERE id = $1',
          [auditId]
        );

        if (auditResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Audit entry not found' });
        }

        const audit = auditResult.rows[0];
        const updateResult = await client.query(`
          UPDATE confidence_settings
          SET setting_value = $1, updated_at = NOW()
          WHERE setting_key = $2
        `, [audit.old_value, audit.setting_key]);

        if (updateResult.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Setting not found: ${audit.setting_key}` });
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

        await client.query('COMMIT');

        clearAutoLearningCache(logger, autoLearningService);

        logger.info('Setting reverted successfully', {
          auditId,
          settingKey: audit.setting_key,
          userId,
        });

        return res.json({ success: true, message: 'Setting reverted successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to revert setting', {
          error: error.message,
          stack: error.stack,
          auditId: req.params.auditId,
          userId: req.user?.id,
        });
        return res.status(500).json({ error: 'Failed to revert setting' });
      } finally {
        client.release();
      }
    },

    async exportSettings(req, res) {
      try {
        const result = await db.query('SELECT * FROM confidence_settings');
        return res.json({
          version: '1.0',
          exportedAt: new Date().toISOString(),
          exportedBy: req.user?.username || 'unknown',
          settings: result.rows,
        });
      } catch (error) {
        logger.error('Failed to export settings', {
          error: error.message,
          userId: req.user?.id,
        });
        return res.status(500).json({ error: 'Failed to export settings' });
      }
    },

    async importSettings(req, res) {
      const client = await db.pool.connect();

      try {
        await client.query('BEGIN');

        const { settings } = req.body;
        const userId = req.user?.id || null;

        if (!Array.isArray(settings)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Settings must be an array' });
        }

        const existingKeys = await client.query('SELECT setting_key FROM confidence_settings');
        const validKeys = new Set(existingKeys.rows.map((row) => row.setting_key));

        for (const setting of settings) {
          if (!setting.setting_key || !validKeys.has(setting.setting_key)) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Invalid or unknown setting key: ${setting.setting_key}`,
            });
          }

          if (setting.setting_value === null || setting.setting_value === undefined) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: `Invalid value for setting: ${setting.setting_key}`,
            });
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

        await client.query('COMMIT');

        clearAutoLearningCache(logger, autoLearningService);

        logger.info('Settings imported successfully', {
          userId,
          settingsCount: settings.length,
        });

        return res.json({ success: true, message: 'Settings imported successfully' });
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to import confidence settings', {
          error: error.message,
          stack: error.stack,
          userId: req.user?.id,
          ip: req.ip,
        });
        return res.status(500).json({ error: 'Failed to import settings' });
      } finally {
        client.release();
      }
    },
  };
}

export default {
  createConfidenceSettingsHandlers,
};