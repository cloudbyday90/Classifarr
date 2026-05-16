/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';
import { normalizeSetupMediaPath } from './setupSupport.mjs';

export function createSetupHandlers({ startupService }) {
  return {
    getSetupStatus: asyncHandler(async (_req, res) => {
      const status = await startupService.getSetupStatus();
      return sendData(res, status);
    }),

    setMediaPath: asyncHandler(async (req, res) => {
      const path = normalizeSetupMediaPath(req.body?.path);

      if (!path) {
        throw new ValidationError('Path is required');
      }

      await startupService.setMediaPath(path);
      const status = await startupService.checkMediaPathStatus();
      return sendData(res, status);
    }),
  };
}
