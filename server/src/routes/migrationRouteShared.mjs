/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';

export function createMigrationRouter({ express, legacyMigration, db }) {
  const router = express.Router();

  router.get('/status', asyncHandler(async (_req, res) => {
    const status = await legacyMigration.getMigrationStatus();
    sendData(res, status);
  }));

  router.get('/libraries', asyncHandler(async (_req, res) => {
    const libraries = await legacyMigration.getLibrariesWithLegacyRules();
    sendData(res, libraries);
  }));

  router.get('/libraries/:id/rules', asyncHandler(async (req, res) => {
    const rules = await legacyMigration.getLegacyRules(req.params.id);
    sendData(res, rules);
  }));

  router.get('/rules/:id/analyze', asyncHandler(async (req, res) => {
    const rule = await db.query('SELECT * FROM library_custom_rules WHERE id = $1', [req.params.id]);

    if (!rule.rows[0]) {
      throw new NotFoundError('Rule not found');
    }

    const analysis = await legacyMigration.analyzeRule(rule.rows[0]);
    sendData(res, analysis);
  }));

  router.post('/rules/:id/migrate', asyncHandler(async (req, res) => {
    const { migrationChoice } = req.body;
    const userId = req.user?.id || null;

    if (!migrationChoice) {
      throw new ValidationError('Migration choice is required');
    }

    const result = await legacyMigration.migrateRule(req.params.id, migrationChoice, userId);
    sendData(res, result);
  }));

  router.post('/libraries/:id/migrate-all', asyncHandler(async (req, res) => {
    const { autoSuggest = true } = req.body;
    const userId = req.user?.id || null;

    const results = await legacyMigration.migrateLibrary(req.params.id, userId, autoSuggest);
    sendData(res, results);
  }));

  return router;
}