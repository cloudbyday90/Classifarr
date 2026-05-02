/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createMigrationRouter({ express, legacyMigration, db, logger }) {
  const router = express.Router();

  router.get('/status', async (_req, res) => {
    try {
      const status = await legacyMigration.getMigrationStatus();
      return res.json(status);
    } catch (error) {
      logger.error('Error getting migration status', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/libraries', async (_req, res) => {
    try {
      const libraries = await legacyMigration.getLibrariesWithLegacyRules();
      return res.json(libraries);
    } catch (error) {
      logger.error('Error getting libraries with legacy rules', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/libraries/:id/rules', async (req, res) => {
    try {
      const rules = await legacyMigration.getLegacyRules(req.params.id);
      return res.json(rules);
    } catch (error) {
      logger.error('Error getting library rules', { libraryId: req.params.id, error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/rules/:id/analyze', async (req, res) => {
    try {
      const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [req.params.id]);

      if (!rule.rows[0]) {
        return res.status(404).json({ error: 'Rule not found' });
      }

      const analysis = await legacyMigration.analyzeRule(rule.rows[0]);
      return res.json(analysis);
    } catch (error) {
      logger.error('Error analyzing rule', { ruleId: req.params.id, error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/rules/:id/migrate', async (req, res) => {
    try {
      const { migrationChoice } = req.body;
      const userId = req.user?.id || null;

      if (!migrationChoice) {
        return res.status(400).json({ error: 'Migration choice is required' });
      }

      const result = await legacyMigration.migrateRule(req.params.id, migrationChoice, userId);
      return res.json(result);
    } catch (error) {
      logger.error('Error migrating rule', { ruleId: req.params.id, error: error.message });
      if (error.status) {
        return res.status(error.status).json({ error: error.message, code: error.code });
      }
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/libraries/:id/migrate-all', async (req, res) => {
    try {
      const { autoSuggest = true } = req.body;
      const userId = req.user?.id || null;

      const results = await legacyMigration.migrateLibrary(req.params.id, userId, autoSuggest);
      return res.json(results);
    } catch (error) {
      logger.error('Error bulk migrating library', { libraryId: req.params.id, error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}