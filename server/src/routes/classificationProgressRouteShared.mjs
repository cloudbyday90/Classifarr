/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData } from '../utils/responseHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';

export function createClassificationProgressRouter({
  express,
  classificationProgressStageService,
}) {
  const router = express.Router();

  /**
   * @swagger
   * /api/classification/progress:
   *   get:
   *     summary: Get all active classifications with progress
   *     tags: [Classification]
   *     responses:
   *       200:
   *         description: List of active classifications
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   taskId:
   *                     type: integer
   *                   title:
   *                     type: string
   *                   currentStage:
   *                     type: string
   *                   progress:
   *                     type: integer
   */
  router.get('/', asyncHandler(async (_req, res) => {
    const activeClassifications = await classificationProgressStageService.getActiveClassifications();
    return sendData(res, activeClassifications);
  }));

  /**
   * @swagger
   * /api/classification/progress/{taskId}:
   *   get:
   *     summary: Get progress for a specific task
   *     tags: [Classification]
   *     parameters:
   *       - in: path
   *         name: taskId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Task progress
   *       404:
   *         description: Task not found
   */
  router.get('/:taskId', asyncHandler(async (req, res) => {
    const progress = await classificationProgressStageService.getProgress(req.params.taskId);

    if (!progress) {
      throw new NotFoundError('Task not found or not processing');
    }

    return sendData(res, progress);
  }));

  return router;
}
