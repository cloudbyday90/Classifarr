/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';
import { ValidationError, NotFoundError } from '../utils/appError.mjs';

export function createSchedulerRouter({ express, schedulerService }) {
  const router = express.Router();

  router.get('/', asyncHandler(async (_req, res) => {
    const tasks = await schedulerService.getAllTasks();
    return sendData(res, tasks);
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const task = await schedulerService.getTaskById(req.params.id);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return sendData(res, task);
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const { name, task_type, library_id, interval_minutes, enabled } = req.body;

    if (!name || !task_type) {
      throw new ValidationError('name and task_type are required');
    }

    if (!interval_minutes || interval_minutes < 5) {
      throw new ValidationError('interval_minutes must be at least 5');
    }

    const task = await schedulerService.createTask({
      name,
      task_type,
      library_id,
      interval_minutes,
      enabled,
    });

    return sendData(res, task, 201);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const task = await schedulerService.updateTask(req.params.id, req.body);
    if (!task) {
      throw new NotFoundError('Task not found');
    }
    return sendData(res, task);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    await schedulerService.deleteTask(req.params.id);
    return sendSuccess(res);
  }));

  router.post('/:id/run', asyncHandler(async (req, res) => {
    const result = await schedulerService.runNow(req.params.id);
    return sendData(res, result);
  }));

  return router;
}
