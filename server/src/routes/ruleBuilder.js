const express = require('express');
const router = express.Router();
const ruleBuilderService = require('../services/ruleBuilder');

/**
 * POST /api/rule-builder/start
 * Start new conversation for building a custom rule
 */
router.post('/start', async (req, res) => {
  try {
    const { libraryId, mediaType } = req.body;

    if (!libraryId || !mediaType) {
      return res.status(400).json({
        error: 'libraryId and mediaType are required',
      });
    }

    if (!['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({
        error: 'mediaType must be "movie" or "tv"',
      });
    }

    const session = await ruleBuilderService.startConversation(libraryId, mediaType);

    res.json({
      success: true,
      sessionId: session.sessionId,
      library: session.library,
      mediaType: session.mediaType,
      message: session.message,
    });
  } catch (error) {
    console.error('Error starting rule builder conversation:', error);
    res.status(500).json({
      error: 'Failed to start conversation',
      message: error.message,
    });
  }
});

/**
 * POST /api/rule-builder/message
 * Send message in an active conversation
 */
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: 'sessionId and message are required',
      });
    }

    const response = await ruleBuilderService.processMessage(sessionId, message);

    res.json({
      success: true,
      sessionId: response.sessionId,
      message: response.message,
      ruleDraft: response.ruleDraft,
      isComplete: response.isComplete,
    });
  } catch (error) {
    console.error('Error processing rule builder message:', error);
    res.status(500).json({
      error: 'Failed to process message',
      message: error.message,
    });
  }
});

/**
 * POST /api/rule-builder/generate
 * Generate final rule from conversation
 */
router.post('/generate', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required',
      });
    }

    const result = await ruleBuilderService.generateRule(sessionId);

    res.json({
      success: true,
      rule: result.rule,
      message: result.message,
    });
  } catch (error) {
    console.error('Error generating rule:', error);
    res.status(500).json({
      error: 'Failed to generate rule',
      message: error.message,
    });
  }
});

/**
 * POST /api/rule-builder/test
 * Test rule against sample data
 */
router.post('/test', async (req, res) => {
  try {
    const { rule, testData } = req.body;

    if (!rule || !testData) {
      return res.status(400).json({
        error: 'rule and testData are required',
      });
    }

    const result = await ruleBuilderService.validateRule(rule, testData);

    res.json({
      success: true,
      matches: result.matches,
      explanation: result.explanation,
      testData: result.testData,
    });
  } catch (error) {
    console.error('Error testing rule:', error);
    res.status(500).json({
      error: 'Failed to test rule',
      message: error.message,
    });
  }
});

/**
 * GET /api/rule-builder/session/:sessionId
 * Get session details
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await ruleBuilderService.getSession(sessionId);

    res.json({
      success: true,
      session: {
        sessionId: session.session_id,
        libraryId: session.library_id,
        mediaType: session.media_type,
        conversation: session.conversation,
        ruleDraft: session.rule_draft,
        status: session.status,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      message: error.message,
    });
  }
});

module.exports = router;
