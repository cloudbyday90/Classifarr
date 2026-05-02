/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createClassificationProgressRouter({
  express,
  classificationPhaseService,
  logger,
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
   *                   currentPhase:
   *                     type: string
   *                   progress:
   *                     type: integer
   */
  router.get('/', async (_req, res) => {
    try {
      const activeClassifications = await classificationPhaseService.getActiveClassifications();
      res.json(activeClassifications);
    } catch (error) {
      logger.error('Failed to get active classifications', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch classification progress' });
    }
  });

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
  router.get('/:taskId', async (req, res) => {
    try {
      const progress = await classificationPhaseService.getProgress(req.params.taskId);

      if (!progress) {
        return res.status(404).json({ error: 'Task not found or not processing' });
      }

      return res.json(progress);
    } catch (error) {
      logger.error('Failed to get task progress', { taskId: req.params.taskId, error: error.message });
      return res.status(500).json({ error: 'Failed to fetch task progress' });
    }
  });

  return router;
}
