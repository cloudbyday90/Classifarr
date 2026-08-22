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
import { requireValidPositiveInt } from './routeHelpers.mjs';

export function registerQueueDecisionWitnessRoute(router, { decisionWitnessReadService }) {
  router.get('/tasks/:id/decision-witness', asyncHandler(async (req, res) => {
    const taskId = requireValidPositiveInt(req.params.id, 'task id', 'invalid_task_id');
    const result = await decisionWitnessReadService.read(taskId);
    return sendData(res, result);
  }));
}
