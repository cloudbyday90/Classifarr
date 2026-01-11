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

const express = require('express');
const router = express.Router();
const legacyMigration = require('../services/legacyMigration');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MigrationRoute');

/**
 * @swagger
 * /api/migration/status:
 *   get:
 *     summary: Get migration status summary
 *     description: Returns counts of pending and migrated legacy rules
 */
router.get('/status', async (req, res) => {
    try {
        const status = await legacyMigration.getMigrationStatus();
        res.json(status);
    } catch (error) {
        logger.error('Error getting migration status', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/migration/libraries:
 *   get:
 *     summary: Get libraries with legacy rules
 *     description: Returns all libraries that have unmigrated legacy rules
 */
router.get('/libraries', async (req, res) => {
    try {
        const libraries = await legacyMigration.getLibrariesWithLegacyRules();
        res.json(libraries);
    } catch (error) {
        logger.error('Error getting libraries with legacy rules', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/migration/libraries/:id/rules:
 *   get:
 *     summary: Get legacy rules for a library
 *     description: Returns all unmigrated rules for a specific library
 */
router.get('/libraries/:id/rules', async (req, res) => {
    try {
        const rules = await legacyMigration.getLegacyRules(req.params.id);
        res.json(rules);
    } catch (error) {
        logger.error('Error getting library rules', { libraryId: req.params.id, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/migration/rules/:id/analyze:
 *   get:
 *     summary: Analyze a rule and get migration suggestions
 *     description: Returns suggested presets or override configurations for a legacy rule
 */
router.get('/rules/:id/analyze', async (req, res) => {
    try {
        const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [req.params.id]);
        if (!rule.rows[0]) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        const analysis = await legacyMigration.analyzeRule(rule.rows[0]);
        res.json(analysis);
    } catch (error) {
        logger.error('Error analyzing rule', { ruleId: req.params.id, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/migration/rules/:id/migrate:
 *   post:
 *     summary: Migrate a single rule
 *     description: Migrates a legacy rule to the policy system using the selected migration choice
 */
router.post('/rules/:id/migrate', async (req, res) => {
    try {
        const { migrationChoice } = req.body;
        const userId = req.user?.id || 1; // Default to user 1 if not authenticated
        
        if (!migrationChoice) {
            return res.status(400).json({ error: 'Migration choice is required' });
        }
        
        const result = await legacyMigration.migrateRule(req.params.id, migrationChoice, userId);
        res.json(result);
    } catch (error) {
        logger.error('Error migrating rule', { ruleId: req.params.id, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/migration/libraries/:id/migrate-all:
 *   post:
 *     summary: Bulk migrate all rules for a library
 *     description: Automatically migrates all unmigrated rules in a library using AI suggestions
 */
router.post('/libraries/:id/migrate-all', async (req, res) => {
    try {
        const { autoSuggest = true } = req.body;
        const userId = req.user?.id || 1;
        
        const results = await legacyMigration.migrateLibrary(req.params.id, userId, autoSuggest);
        res.json(results);
    } catch (error) {
        logger.error('Error bulk migrating library', { libraryId: req.params.id, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
