const express = require('express');
const classificationService = require('../services/classification');

const router = express.Router();

/**
 * @swagger
 * /api/webhook/overseerr:
 *   post:
 *     summary: Overseerr webhook endpoint
 *     description: Receives media requests from Overseerr/Jellyseerr and classifies them
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Classification successful
 *       500:
 *         description: Classification failed
 */
router.post('/overseerr', async (req, res) => {
  try {
    console.log('Received Overseerr webhook:', JSON.stringify(req.body, null, 2));
    
    const result = await classificationService.classify(req.body);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
