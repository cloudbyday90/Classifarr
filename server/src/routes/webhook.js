const express = require('express');
const router = express.Router();
const classificationService = require('../services/classification');
const { sendClassificationNotification } = require('../services/discordBot');

/**
 * Overseerr webhook endpoint
 */
router.post('/overseerr', async (req, res) => {
  try {
    const payload = req.body;

    console.log('📨 Received Overseerr webhook:', payload.notification_type);

    // Validate payload
    if (!payload.media?.tmdbId) {
      return res.status(400).json({ 
        error: 'Invalid payload',
        message: 'Missing required field: media.tmdbId'
      });
    }

    // Only process on request approval
    if (payload.notification_type !== 'MEDIA_APPROVED' && 
        payload.notification_type !== 'MEDIA_AUTO_APPROVED') {
      console.log('Ignoring non-approval notification');
      return res.status(200).json({ 
        status: 'ignored',
        message: 'Only processing approval notifications'
      });
    }

    // Respond immediately (Overseerr doesn't wait for processing)
    res.status(200).json({ 
      status: 'processing',
      message: 'Classification started'
    });

    // Process classification asynchronously
    classificationService.classify(payload)
      .then(async (result) => {
        console.log(`✓ Classified ${payload.media.title} → ${result.library?.name || 'Unassigned'}`);
        
        // Get full metadata for Discord notification
        const metadata = await classificationService.enrichMetadata(
          payload.media.tmdbId,
          payload.media.media_type || 'movie'
        );

        // Send Discord notification
        await sendClassificationNotification(metadata, result);
      })
      .catch((err) => {
        console.error('❌ Classification failed:', err.message);
      });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message
    });
  }
});

/**
 * Test webhook endpoint
 */
router.post('/test', async (req, res) => {
  res.json({
    status: 'ok',
    message: 'Webhook endpoint is working',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
