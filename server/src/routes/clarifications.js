const express = require('express');
const db = require('../config/database');
const clarificationService = require('../services/clarification');

const router = express.Router();

/**
 * @swagger
 * /api/clarifications/:classificationId:
 *   get:
 *     summary: Get clarification questions for a classification
 */
router.get('/:classificationId', async (req, res) => {
  try {
    const { classificationId } = req.params;

    // Get classification
    const classResult = await db.query(
      'SELECT * FROM classification_history WHERE id = $1',
      [classificationId]
    );

    if (classResult.rows.length === 0) {
      return res.status(404).json({ error: 'Classification not found' });
    }

    const classification = classResult.rows[0];
    const metadata = classification.metadata || {};

    // Get questions
    const questions = await clarificationService.getQuestionsForMedia(metadata, 3);

    // Get existing responses
    const responsesResult = await db.query(
      'SELECT * FROM clarification_responses WHERE classification_id = $1',
      [classificationId]
    );

    res.json({
      classification: {
        id: classification.id,
        title: classification.title,
        year: classification.year,
        media_type: classification.media_type,
        confidence: classification.confidence,
      },
      questions,
      responses: responsesResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/clarifications/:classificationId/respond:
 *   post:
 *     summary: Submit a clarification response
 */
router.post('/:classificationId/respond', async (req, res) => {
  try {
    const { classificationId } = req.params;
    const { question_key, selected_value, responded_by = 'user' } = req.body;

    if (!question_key || !selected_value) {
      return res.status(400).json({ error: 'question_key and selected_value are required' });
    }

    // Process response
    const result = await clarificationService.processResponse(
      parseInt(classificationId),
      question_key,
      selected_value,
      responded_by
    );

    // Update classification status
    await db.query(
      `UPDATE classification_history 
       SET clarification_questions_asked = clarification_questions_asked + 1,
           clarification_status = 'in_progress'
       WHERE id = $1`,
      [classificationId]
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/clarifications/:classificationId/reclassify:
 *   post:
 *     summary: Reclassify with clarification responses
 */
router.post('/:classificationId/reclassify', async (req, res) => {
  try {
    const { classificationId } = req.params;

    const result = await clarificationService.reclassifyWithClarifications(
      parseInt(classificationId)
    );

    // Save learning pattern if successful
    if (result.success) {
      await clarificationService.savePatternFromClarification(
        parseInt(classificationId)
      );
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/clarifications/stats:
 *   get:
 *     summary: Get clarification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await clarificationService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
