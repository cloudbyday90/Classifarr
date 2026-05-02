/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { parseInteger, safeParsePolicyQuestion } from './clarificationRouteHelpers.mjs';

export function createClarificationRouter({
  express,
  clarificationService,
  db,
  logger,
}) {
  const router = express.Router();

  router.get('/settings/confidence', async (_req, res) => {
    try {
      const thresholds = await clarificationService.getThresholds();
      res.json(thresholds);
    } catch (error) {
      logger.error('Error getting thresholds', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/settings/confidence/:tier', async (req, res) => {
    try {
      const { tier } = req.params;
      const updates = req.body;

      const result = await clarificationService.updateThreshold(tier, updates);
      res.json(result);
    } catch (error) {
      logger.error('Error updating threshold', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/settings/questions', async (_req, res) => {
    try {
      const questions = await clarificationService.getAllQuestions();
      res.json(questions);
    } catch (error) {
      logger.error('Error getting questions', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/settings/questions', async (req, res) => {
    try {
      const questionData = req.body;

      if (!questionData.question_text || !questionData.question_type || !questionData.response_options) {
        return res.status(400).json({
          error: 'Missing required fields: question_text, question_type, response_options',
        });
      }

      const result = await clarificationService.createQuestion(questionData);
      res.json(result);
    } catch (error) {
      logger.error('Error creating question', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/settings/questions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const result = await clarificationService.updateQuestion(parseInteger(id), updates);
      res.json(result);
    } catch (error) {
      logger.error('Error updating question', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/settings/questions/:id', async (req, res) => {
    try {
      const { id } = req.params;

      await clarificationService.deleteQuestion(parseInteger(id));
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting question', { error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:classificationId', async (req, res) => {
    try {
      const { classificationId } = req.params;
      const { maxQuestions = 3 } = req.query;

      const result = await db.query(
        'SELECT metadata, policy_question FROM classification_history WHERE id = $1',
        [classificationId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Classification not found' });
      }

      const { metadata, policy_question: policyQuestion } = result.rows[0];
      const parsedPolicyQuestion = safeParsePolicyQuestion(policyQuestion);
      if (parsedPolicyQuestion) {
        return res.json([parsedPolicyQuestion]);
      }

      const questions = await clarificationService.matchQuestions(
        metadata,
        parseInteger(maxQuestions),
      );

      return res.json(questions);
    } catch (error) {
      logger.error('Error getting clarification questions', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/respond', async (req, res) => {
    try {
      const { classificationId, questionId, responseValue, discordUserId, confidenceBefore } = req.body;

      if (!classificationId || !questionId || !responseValue) {
        return res.status(400).json({
          error: 'Missing required fields: classificationId, questionId, responseValue',
        });
      }

      const result = await clarificationService.recordResponse(
        parseInteger(classificationId),
        parseInteger(questionId),
        responseValue,
        discordUserId || null,
        parseInteger(confidenceBefore),
      );

      return res.json(result);
    } catch (error) {
      logger.error('Error recording response', { error: error.message });
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
