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
import { ValidationError, NotFoundError } from '../utils/appError.mjs';

export function registerCorrectionRoutes(router, { db, classificationOutcomeService, classificationEvidenceService, classificationEvidenceReinforcementService, PATTERN_SIGNAL_TYPES, reclassificationService, logger }) {
  router.post('/corrections', asyncHandler(async (req, res) => {
    const { classification_id, corrected_library_id, corrected_by } = req.body;

    if (!classification_id || !corrected_library_id) {
      throw new ValidationError('classification_id and corrected_library_id are required');
    }

    const classResult = await db.query(
      'SELECT library_id, tmdb_id, media_type, metadata FROM classification_history WHERE id = $1',
      [classification_id]
    );

    if (classResult.rows.length === 0) {
      throw new NotFoundError('Classification not found');
    }

    const { library_id: original_library_id, tmdb_id, media_type, metadata } = classResult.rows[0];

    await db.query(
      `UPDATE classification_history 
       SET library_id = $1, 
           library_name = (SELECT name FROM libraries WHERE id = $1),
           status = $2 
       WHERE id = $3`,
      [corrected_library_id, 'corrected', classification_id]
    );

    const correctionResult = await db.query(
      `INSERT INTO classification_corrections 
       (classification_id, original_library_id, corrected_library_id, corrected_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [classification_id, original_library_id, corrected_library_id, corrected_by || 'user']
    );

    const correctedLibraryLookup = await db.query('SELECT name FROM libraries WHERE id = $1', [corrected_library_id]);
    await classificationOutcomeService.recordOutcome(classification_id, {
      type: 'corrected',
      source: 'api_correction',
      actor: corrected_by || 'user',
      final_library_id: corrected_library_id,
      final_library_name: correctedLibraryLookup.rows[0]?.name || null,
    });

    await classificationEvidenceService.rememberExactMatch({
      tmdbId: tmdb_id,
      mediaType: media_type || 'unknown',
      libraryId: corrected_library_id,
      payload: metadata,
      payloadColumn: 'pattern_data',
      conflictMode: 'do_nothing',
    });

    setImmediate(async () => {
      try {
        const signalsResult = await db.query('SELECT signals_json FROM classification_history WHERE id = $1', [classification_id]);

        if (signalsResult.rows.length > 0 && signalsResult.rows[0].signals_json) {
          const signals = signalsResult.rows[0].signals_json;
          const patternSignals = signals.filter((signal) => signal.type && PATTERN_SIGNAL_TYPES.includes(signal.type));

          if (patternSignals.length > 0) {
            await classificationEvidenceReinforcementService.reinforceOnCorrection(
              classification_id,
              patternSignals,
              corrected_library_id,
              { metadata, mediaType: media_type }
            );
          }
        }
      } catch (error) {
        logger.error('Pattern reinforcement failed for classification', {
          classification_id,
          error: error.message,
        });
      }
    });

    res.json(correctionResult.rows[0]);
  }));

  router.post('/reclassify', asyncHandler(async (req, res) => {
    const { classification_id, target_library_id, corrected_by } = req.body;

    if (!classification_id || !target_library_id) {
      throw new ValidationError('classification_id and target_library_id are required');
    }

    const result = await reclassificationService.executeReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id,
      correctedBy: corrected_by || 'user',
    });

    res.json(result);
  }));

  router.post('/reclassify/preview', asyncHandler(async (req, res) => {
    const { classification_id, target_library_id } = req.body;

    if (!classification_id || !target_library_id) {
      throw new ValidationError('classification_id and target_library_id are required');
    }

    const preview = await reclassificationService.previewReclassification({
      classificationId: classification_id,
      targetLibraryId: target_library_id,
    });

    res.json(preview);
  }));
}
