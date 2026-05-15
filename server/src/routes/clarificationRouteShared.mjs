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
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

import { parseInteger, safeParsePolicyQuestion } from './clarificationRouteHelpers.mjs';

export function createClarificationRouter({
  express,
  clarificationService,
  db,
}) {
  const router = express.Router();

  router.get('/settings/confidence', asyncHandler(async (_req, res) => {
    const thresholds = await clarificationService.getThresholds();
    sendData(res, thresholds);
  }));

  router.put('/settings/confidence/:tier', asyncHandler(async (req, res) => {
    const { tier } = req.params;
    const updates = req.body;

    const result = await clarificationService.updateThreshold(tier, updates);
    sendData(res, result);
  }));

  router.get('/settings/questions', asyncHandler(async (_req, res) => {
    const questions = await clarificationService.getAllQuestions();
    sendData(res, questions);
  }));

  router.post('/settings/questions', asyncHandler(async (req, res) => {
    const questionData = req.body;

    if (!questionData.question_text || !questionData.question_type || !questionData.response_options) {
      return sendError(res, 'Missing required fields: question_text, question_type, response_options');
    }

    const result = await clarificationService.createQuestion(questionData);
    sendData(res, result);
  }));

  router.put('/settings/questions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const result = await clarificationService.updateQuestion(parseInteger(id), updates);
    sendData(res, result);
  }));

  router.delete('/settings/questions/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    await clarificationService.deleteQuestion(parseInteger(id));
    sendSuccess(res);
  }));

  router.get('/:classificationId', asyncHandler(async (req, res) => {
    const { classificationId } = req.params;
    const { maxQuestions = 3 } = req.query;

    const result = await db.query(
      'SELECT metadata, policy_question FROM classification_history WHERE id = $1',
      [classificationId],
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Classification not found', 404);
    }

    const { metadata, policy_question: policyQuestion } = result.rows[0];
    const parsedPolicyQuestion = safeParsePolicyQuestion(policyQuestion);
    if (parsedPolicyQuestion) {
      return sendData(res, [parsedPolicyQuestion]);
    }

    const questions = await clarificationService.matchQuestions(
      metadata,
      parseInteger(maxQuestions),
    );

    return sendData(res, questions);
  }));

  router.post('/:id/respond', asyncHandler(async (req, res) => {
    const { classificationId, questionId, responseValue, discordUserId, confidenceBefore } = req.body;

    if (!classificationId || !questionId || !responseValue) {
      return sendError(res, 'Missing required fields: classificationId, questionId, responseValue');
    }

    const result = await clarificationService.recordResponse(
      parseInteger(classificationId),
      parseInteger(questionId),
      responseValue,
      discordUserId || null,
      parseInteger(confidenceBefore),
    );

    return sendData(res, result);
  }));

  return router;
}
