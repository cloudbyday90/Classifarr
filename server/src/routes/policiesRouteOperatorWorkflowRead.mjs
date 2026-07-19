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
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import {
  policyOperatorWorkflowReadService,
} from '../services/policyOperatorWorkflowReadService.mjs';

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function toRouting(mapping = {}) {
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

export function registerPolicyOperatorWorkflowReadRoutes(router, {
  db,
  operatorWorkflowReadService = policyOperatorWorkflowReadService,
} = {}) {
  router.get('/operator-workflow/libraries/:libraryId', asyncHandler(async (req, res) => {
    const libraryId = normalizeLibraryId(req.params.libraryId);
    if (libraryId === null) {
      throw new ValidationError('libraryId must be a positive integer');
    }

    const libraryResult = await db.query(`
      SELECT id, name, media_type
      FROM libraries
      WHERE id = $1
    `, [libraryId]);
    const library = libraryResult.rows?.[0] || null;
    if (!library) {
      throw new NotFoundError('Library not found');
    }

    const mappingResult = await db.query(`
      SELECT arr_type, arr_config_id, arr_root_folder_path
      FROM library_arr_mappings
      WHERE library_id = $1
      LIMIT 1
    `, [libraryId]);

    const result = await operatorWorkflowReadService.getWorkflow({
      library,
      routing: toRouting(mappingResult.rows?.[0]),
    });

    return sendData(res, result);
  }));
}
