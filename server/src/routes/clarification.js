/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const express = require('express');
const clarificationService = require('../services/clarificationService');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('clarification-routes');

/**
 * @route GET /api/clarifications/:classificationId
 * @desc Get matched clarification questions for a classification
 */
router.get('/:classificationId', async (req, res) => {
  try {
    const { classificationId } = req.params;
    const { maxQuestions = 3 } = req.query;

    // Get classification metadata
    const db = require('../config/database');
    const result = await db.query(
      'SELECT metadata FROM classification_history WHERE id = $1',
      [classificationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    const metadata = result.rows[0].metadata;
    const questions = await clarificationService.matchQuestions(
      metadata,
      parseInt(maxQuestions)
    );

    res.json(questions);
  } catch (error) {
    logger.error('Error getting clarification questions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/clarifications/:id/respond
 * @desc Submit clarification response
 */
router.post('/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { classificationId, questionId, responseValue, discordUserId, confidenceBefore } = req.body;

    if (!classificationId || !questionId || !responseValue) {
      return res.status(400).json({
        error: 'Missing required fields: classificationId, questionId, responseValue',
      });
    }

    const result = await clarificationService.recordResponse(
      parseInt(classificationId),
      parseInt(questionId),
      responseValue,
      discordUserId || null,
      parseInt(confidenceBefore)
    );

    res.json(result);
  } catch (error) {
    logger.error('Error recording response', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route GET /api/clarifications/settings/confidence
 * @desc Get confidence thresholds
 */
router.get('/settings/confidence', async (req, res) => {
  try {
    const thresholds = await clarificationService.getThresholds();
    res.json(thresholds);
  } catch (error) {
    logger.error('Error getting thresholds', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route PUT /api/clarifications/settings/confidence/:tier
 * @desc Update confidence threshold
 */
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

/**
 * @route GET /api/clarifications/settings/questions
 * @desc Get all clarification questions
 */
router.get('/settings/questions', async (req, res) => {
  try {
    const questions = await clarificationService.getAllQuestions();
    res.json(questions);
  } catch (error) {
    logger.error('Error getting questions', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route POST /api/clarifications/settings/questions
 * @desc Create clarification question
 */
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

/**
 * @route PUT /api/clarifications/settings/questions/:id
 * @desc Update clarification question
 */
router.put('/settings/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await clarificationService.updateQuestion(parseInt(id), updates);
    res.json(result);
  } catch (error) {
    logger.error('Error updating question', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route DELETE /api/clarifications/settings/questions/:id
 * @desc Delete clarification question
 */
router.delete('/settings/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await clarificationService.deleteQuestion(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting question', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
