const express = require('express');
const ruleBuilderService = require('../services/ruleBuilder');

const router = express.Router();

/**
 * @swagger
 * /api/rule-builder/start:
 *   post:
 *     summary: Start a rule builder session
 */
router.post('/start', async (req, res) => {
  try {
    const { library_id, media_type } = req.body;

    if (!library_id || !media_type) {
      return res.status(400).json({ error: 'library_id and media_type are required' });
    }

    const result = await ruleBuilderService.startSession(library_id, media_type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/rule-builder/message:
 *   post:
 *     summary: Send a message in the rule builder session
 */
router.post('/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({ error: 'session_id and message are required' });
    }

    const result = await ruleBuilderService.processMessage(session_id, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/rule-builder/generate:
 *   post:
 *     summary: Generate rule from session
 */
router.post('/generate', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const result = await ruleBuilderService.generateRule(session_id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/rule-builder/test:
 *   post:
 *     summary: Test a rule against sample data
 */
router.post('/test', async (req, res) => {
  try {
    const { rule, sample_data } = req.body;

    if (!rule || !sample_data) {
      return res.status(400).json({ error: 'rule and sample_data are required' });
    }

    const result = await ruleBuilderService.testRule(rule, sample_data);
    res.json({ matches: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
