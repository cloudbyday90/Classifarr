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

export function createSyncRouter({ express, syncStatus }) {
  const router = express.Router();

  router.get('/status', asyncHandler(async (_req, res) => {
    const status = syncStatus.getStatus();
    return sendData(res, status);
  }));

  return router;
}
