const express = require('express');
const router = express.Router();
const classificationPhaseService = require('../services/classificationPhaseService');
const { authenticate } = require('../middleware/auth');

/**
 * Get all active classification progress
 * GET /api/activity/progress
 */
router.get('/progress', authenticate, async (req, res) => {
  try {
    const activeClassifications = await classificationPhaseService.getActiveClassifications();
    res.json({
      success: true,
      data: activeClassifications
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch classification progress'
    });
  }
});

/**
 * Get progress for a specific task
 * GET /api/activity/progress/:taskId
 */
router.get('/progress/:taskId', authenticate, async (req, res) => {
  try {
    const { taskId } = req.params;
    const progress = await classificationPhaseService.getProgress(taskId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error fetching task progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch task progress'
    });
  }
});

module.exports = router;
