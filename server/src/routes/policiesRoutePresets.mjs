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
import { parseIntParam } from './evidenceRouteHelpers.mjs';
import { requireValidId } from './routeHelpers.mjs';
import {
  annotatePresetAttachment,
  isLegacyIncompatibleAttachment,
  fetchPolicyPresetAttachments,
} from './policiesRouteHelpers.mjs';
import {
  buildPolicyStarterTemplateSuggestions,
} from '../services/policyStarterTemplateSuggestions.mjs';
import {
  POLICY_LEGACY_WRITE_OPERATION_IDS,
} from '../services/policyLegacyWriteBoundary.mjs';
import {
  assertLegacyPolicyWriteAllowed,
  lockPolicyAuthorityForWrite,
} from '../services/policyLegacyWriteGuard.mjs';

export function registerPresetRoutes(router, { db, listPresets, normalizeSignalConfig, describePresetRuntimeSemantics, logger }) {
  function annotate(preset) {
    return annotatePresetAttachment(preset, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  function fetchAttachments(policyId = null) {
    return fetchPolicyPresetAttachments(db, policyId, normalizeSignalConfig, describePresetRuntimeSemantics);
  }

  router.get('/presets/all', asyncHandler(async (req, res) => {
    const { category, search, include_custom } = req.query;
    const presets = await listPresets({
      category,
      search,
      includeCustom: include_custom !== 'false',
      orderBy: 'policy',
    });

    return sendData(res, presets);
  }));

  router.get('/presets/categories', asyncHandler(async (_req, res) => {
    const result = await db.query(`
      SELECT 
        category,
        COUNT(*) as count
      FROM content_presets
      WHERE category IS NOT NULL
      GROUP BY category
      ORDER BY category
    `);

    return sendData(res, result.rows);
  }));

  router.get('/presets/:presetId/usage', asyncHandler(async (req, res) => {
    const presetIdNum = requireValidId(req.params.presetId, 'presetId');

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM policy_presets
      WHERE preset_id = $1
    `, [presetIdNum]);

    return sendData(res, { count: parseInt(result.rows[0].count, 10) });
  }));

  router.get('/presets/suggest/:libraryId', asyncHandler(async (req, res) => {
    const { libraryId } = req.params;

    const libraryResult = await db.query(
      'SELECT id, name, media_type FROM libraries WHERE id = $1',
      [libraryId],
    );

    if (libraryResult.rows.length === 0) {
      throw new NotFoundError('Library not found');
    }

    const library = libraryResult.rows[0];

    const presetRows = await listPresets({
      includeCustom: true,
      orderBy: 'policy',
    });

    const topSuggestions = buildPolicyStarterTemplateSuggestions({
      library,
      presets: presetRows,
    });

    logger.info('Preset suggestions generated', {
      libraryId,
      libraryName: library.name,
      suggestionCount: topSuggestions.length,
      topMatch: topSuggestions[0]?.name,
    });

    return sendData(res, {
      library_id: library.id,
      library_name: library.name,
      suggestions: topSuggestions,
    });
  }));

  router.get('/presets/migration/incompatible', asyncHandler(async (req, res) => {
    const policyId = parseIntParam(req.query.policy_id, null, 1);
    if (req.query.policy_id && policyId === null) {
      throw new ValidationError('policy_id must be a positive integer');
    }

    const attachments = await fetchAttachments(policyId);
    const incompatible = attachments.filter(isLegacyIncompatibleAttachment);

    return sendData(res, {
      count: incompatible.length,
      attachments: incompatible,
    });
  }));

  router.post('/presets/migration/drop-incompatible', asyncHandler(async (req, res) => {
    const policyId = req.body?.policy_id ? Number.parseInt(req.body.policy_id, 10) : null;
    if (req.body?.policy_id && (!Number.isInteger(policyId) || policyId < 1)) {
      throw new ValidationError('policy_id must be a positive integer');
    }

    const dropped = await db.withTransaction(async (client) => {
      const params = [];
      let whereClause = '';

      if (policyId) {
        params.push(policyId);
        whereClause = 'WHERE pp.policy_id = $1';
      }

      const attachmentsResult = await client.query(`
        SELECT 
          lp.id as policy_id,
          lp.name as policy_name,
          l.id as library_id,
          l.name as library_name,
          cp.*,
          pp.weight,
          pp.custom_signals
        FROM policy_presets pp
        JOIN library_policies lp ON pp.policy_id = lp.id
        JOIN libraries l ON lp.library_id = l.id
        JOIN content_presets cp ON pp.preset_id = cp.id
        ${whereClause}
        ORDER BY l.name, lp.name, cp.name
      `, params);

      const incompatible = attachmentsResult.rows
        .map(annotate)
        .filter(isLegacyIncompatibleAttachment);

      for (const attachment of incompatible) {
        const policy = await lockPolicyAuthorityForWrite({
          client,
          policyId: attachment.policy_id,
        });
        assertLegacyPolicyWriteAllowed({
          policy,
          payload: { preset_id: attachment.id },
          operationId: POLICY_LEGACY_WRITE_OPERATION_IDS.DETACH_PRESET,
        });

        await client.query(
          'DELETE FROM policy_presets WHERE policy_id = $1 AND preset_id = $2',
          [attachment.policy_id, attachment.id],
        );
      }

      return incompatible;
    });

    return sendData(res, {
      dropped_count: dropped.length,
      dropped,
    });
  }));
}
