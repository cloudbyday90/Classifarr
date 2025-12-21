/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Backup/restore routes for rules and settings
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BackupRoutes');

const BACKUP_VERSION = '1.0';

/**
 * @swagger
 * /api/backup/export:
 *   get:
 *     summary: Export rules and settings as JSON
 */
router.get('/export', async (req, res) => {
    try {
        const [
            libraries,
            libraryLabels,
            customRules,
            learningPatterns,
            labelPresets,
            scheduledTasks
        ] = await Promise.all([
            db.query('SELECT * FROM libraries ORDER BY id'),
            db.query('SELECT * FROM library_labels ORDER BY id'),
            db.query('SELECT * FROM library_custom_rules ORDER BY id'),
            db.query('SELECT * FROM learning_patterns ORDER BY id'),
            db.query('SELECT * FROM label_presets ORDER BY id'),
            db.query('SELECT * FROM scheduled_tasks ORDER BY id')
        ]);

        const backup = {
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            data: {
                libraries: libraries.rows,
                libraryLabels: libraryLabels.rows,
                customRules: customRules.rows,
                learningPatterns: learningPatterns.rows,
                labelPresets: labelPresets.rows,
                scheduledTasks: scheduledTasks.rows
            },
            meta: {
                libraryCount: libraries.rows.length,
                customRulesCount: customRules.rows.length,
                learningPatternsCount: learningPatterns.rows.length
            }
        };

        logger.info('Exported backup', backup.meta);

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="classifarr-backup-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(backup);
    } catch (error) {
        logger.error('Export failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/backup/import:
 *   post:
 *     summary: Import rules and settings from JSON backup
 */
router.post('/import', async (req, res) => {
    try {
        const { data, options = {} } = req.body;
        const { mergeMode = 'skip' } = options; // 'skip', 'overwrite', or 'merge'

        if (!data) {
            return res.status(400).json({ error: 'No backup data provided' });
        }

        const results = {
            customRules: { imported: 0, skipped: 0 },
            learningPatterns: { imported: 0, skipped: 0 },
            scheduledTasks: { imported: 0, skipped: 0 }
        };

        // Import custom rules
        if (data.customRules?.length) {
            for (const rule of data.customRules) {
                try {
                    const exists = await db.query(
                        'SELECT id FROM library_custom_rules WHERE name = $1 AND library_id = $2',
                        [rule.name, rule.library_id]
                    );

                    if (exists.rows.length > 0 && mergeMode === 'skip') {
                        results.customRules.skipped++;
                        continue;
                    }

                    if (exists.rows.length > 0 && mergeMode === 'overwrite') {
                        await db.query(
                            `UPDATE library_custom_rules SET rule_json = $1, description = $2, is_active = $3, updated_at = NOW()
               WHERE name = $4 AND library_id = $5`,
                            [rule.rule_json, rule.description, rule.is_active, rule.name, rule.library_id]
                        );
                    } else if (exists.rows.length === 0) {
                        await db.query(
                            `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
               VALUES ($1, $2, $3, $4, $5)`,
                            [rule.library_id, rule.name, rule.description, rule.rule_json, rule.is_active ?? true]
                        );
                    }
                    results.customRules.imported++;
                } catch (e) {
                    logger.warn('Failed to import custom rule', { name: rule.name, error: e.message });
                }
            }
        }

        // Import learning patterns
        if (data.learningPatterns?.length) {
            for (const pattern of data.learningPatterns) {
                try {
                    const exists = await db.query(
                        'SELECT id FROM learning_patterns WHERE tmdb_id = $1 AND media_type = $2',
                        [pattern.tmdb_id, pattern.media_type]
                    );

                    if (exists.rows.length > 0 && mergeMode === 'skip') {
                        results.learningPatterns.skipped++;
                        continue;
                    }

                    if (exists.rows.length > 0) {
                        await db.query(
                            `UPDATE learning_patterns SET library_id = $1, confidence = $2, method = $3, updated_at = NOW()
               WHERE tmdb_id = $4 AND media_type = $5`,
                            [pattern.library_id, pattern.confidence, pattern.method, pattern.tmdb_id, pattern.media_type]
                        );
                    } else {
                        await db.query(
                            `INSERT INTO learning_patterns (tmdb_id, media_type, library_id, title, confidence, method)
               VALUES ($1, $2, $3, $4, $5, $6)`,
                            [pattern.tmdb_id, pattern.media_type, pattern.library_id, pattern.title, pattern.confidence, pattern.method]
                        );
                    }
                    results.learningPatterns.imported++;
                } catch (e) {
                    logger.warn('Failed to import learning pattern', { tmdb_id: pattern.tmdb_id, error: e.message });
                }
            }
        }

        // Import scheduled tasks
        if (data.scheduledTasks?.length) {
            for (const task of data.scheduledTasks) {
                try {
                    const exists = await db.query(
                        'SELECT id FROM scheduled_tasks WHERE name = $1',
                        [task.name]
                    );

                    if (exists.rows.length > 0 && mergeMode === 'skip') {
                        results.scheduledTasks.skipped++;
                        continue;
                    }

                    if (exists.rows.length === 0) {
                        await db.query(
                            `INSERT INTO scheduled_tasks (name, task_type, library_id, interval_minutes, enabled)
               VALUES ($1, $2, $3, $4, $5)`,
                            [task.name, task.task_type, task.library_id, task.interval_minutes, task.enabled ?? true]
                        );
                        results.scheduledTasks.imported++;
                    }
                } catch (e) {
                    logger.warn('Failed to import scheduled task', { name: task.name, error: e.message });
                }
            }
        }

        logger.info('Import completed', results);
        res.json({ success: true, results });
    } catch (error) {
        logger.error('Import failed', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/backup/preview:
 *   post:
 *     summary: Preview what would be imported from backup
 */
router.post('/preview', async (req, res) => {
    try {
        const { data } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'No backup data provided' });
        }

        const preview = {
            customRules: data.customRules?.length || 0,
            learningPatterns: data.learningPatterns?.length || 0,
            scheduledTasks: data.scheduledTasks?.length || 0,
            libraries: data.libraries?.length || 0,
            labelPresets: data.labelPresets?.length || 0
        };

        res.json(preview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
