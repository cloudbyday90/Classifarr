/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { NotFoundError } from '../utils/appError.mjs';
import {
  buildPolicyStarterTemplateIntentSignalSuggestions,
  buildPolicyStarterTemplateSuggestions,
} from '../services/policyStarterTemplateSuggestions.mjs';

function normalizePolicyOperatorWorkflowLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function toPolicyOperatorWorkflowRouting(mapping = {}) {
  const rootFolderPath = typeof mapping.arr_root_folder_path === 'string'
    ? mapping.arr_root_folder_path.trim()
    : '';
  const arrType = typeof mapping.arr_type === 'string' ? mapping.arr_type.trim() : '';
  const configured = Boolean(mapping.arr_config_id && rootFolderPath && arrType);

  return {
    configured,
    routeReady: configured,
    targetName: configured ? `${arrType} library mapping` : null,
  };
}

async function loadPolicyOperatorWorkflowLibrary({ db, libraryId } = {}) {
  const libraryResult = await db.query(`
    SELECT id, name, media_type
    FROM libraries
    WHERE id = $1
  `, [libraryId]);
  const library = libraryResult.rows?.[0] || null;
  if (!library) {
    throw new NotFoundError('Library not found');
  }

  return library;
}

async function loadPolicyOperatorWorkflowRouteContext({ db, libraryId } = {}) {
  const library = await loadPolicyOperatorWorkflowLibrary({ db, libraryId });

  const mappingResult = await db.query(`
    SELECT arr_type, arr_config_id, arr_root_folder_path
    FROM library_arr_mappings
    WHERE library_id = $1
    LIMIT 1
  `, [libraryId]);

  return {
    library,
    routing: toPolicyOperatorWorkflowRouting(mappingResult.rows?.[0]),
  };
}

async function loadPolicyOperatorWorkflowStarterTemplateSuggestions({
  library,
  listPresets,
  logger,
} = {}) {
  if (typeof listPresets !== 'function') return [];

  try {
    const presets = await listPresets({ includeCustom: true, orderBy: 'policy' });
    return buildPolicyStarterTemplateIntentSignalSuggestions({
      suggestions: buildPolicyStarterTemplateSuggestions({ library, presets }),
    });
  } catch (error) {
    logger?.warn('Policy starter-template suggestions were unavailable for workflow read', {
      libraryId: library?.id ?? null,
      error: error.message,
    });
    return [];
  }
}

export {
  loadPolicyOperatorWorkflowLibrary,
  loadPolicyOperatorWorkflowRouteContext,
  loadPolicyOperatorWorkflowStarterTemplateSuggestions,
  normalizePolicyOperatorWorkflowLibraryId,
  toPolicyOperatorWorkflowRouting,
};
