const express = require('express');
const router = express.Router();
const ruleBuilderService = require('../services/ruleBuilder');

/**
 * Start a new rule building session
 */
router.post('/session/start', async (req, res) => {
  try {
    const { library_id, media_type, user_id } = req.body;

    if (!library_id || !media_type) {
      return res.status(400).json({ error: 'Missing required fields: library_id, media_type' });
    }

    const result = await ruleBuilderService.startSession(library_id, media_type, user_id || 'anonymous');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Send a message in a session
 */
router.post('/session/:sessionId/message', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing required field: message' });
    }

    const result = await ruleBuilderService.processMessage(req.params.sessionId, message);
    res.json(result);
  } catch (err) {
    if (err.message === 'Session not found or expired') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Generate rule from session
 */
router.post('/session/:sessionId/generate', async (req, res) => {
  try {
    const { rule_name } = req.body;

    const result = await ruleBuilderService.generateRule(req.params.sessionId, rule_name);
    res.json(result);
  } catch (err) {
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * Test a rule against sample media
 */
router.post('/test', async (req, res) => {
  try {
    const { rule, sample_media } = req.body;

    if (!rule) {
      return res.status(400).json({ error: 'Missing required field: rule' });
    }

    const result = await ruleBuilderService.testRule(rule, sample_media);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
