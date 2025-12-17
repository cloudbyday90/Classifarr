const express = require('express');
const webhookService = require('../services/webhook');
const classificationService = require('../services/classification');
const discordBot = require('../services/discordBot');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/webhook/overseerr:
 *   post:
 *     summary: Overseerr/Jellyseerr webhook endpoint
 *     description: Receives media requests and other events from Overseerr/Jellyseerr
 */
router.post('/overseerr', async (req, res) => {
  const startTime = Date.now();
  let logId = null;
  
  try {
    // Get webhook config
    const config = await webhookService.getConfig();
    
    // Check if webhooks are enabled
    if (!config.enabled) {
      return res.status(503).json({ error: 'Webhooks are currently disabled' });
    }
    
    // Validate authentication
    const providedKey = req.query.key || req.headers['x-webhook-key'];
    if (!webhookService.validateAuth(providedKey, config)) {
      logger.warn('Webhook', 'Invalid webhook key provided');
      return res.status(401).json({ error: 'Invalid webhook key' });
    }
    
    // Parse payload
    const parsed = webhookService.parsePayload(req.body);
    logger.info('Webhook', `Received ${parsed.notification_type}: ${parsed.subject}`);
    
    // Log the webhook
    logId = await webhookService.logReceived(req, parsed);
    
    // Handle by notification type
    let result;
    
    switch (parsed.notification_type) {
      case 'TEST_NOTIFICATION':
        result = { 
          success: true, 
          message: 'Test notification received successfully',
          timestamp: new Date().toISOString()
        };
        await webhookService.updateLog(logId, { status: 'completed', processing_time_ms: Date.now() - startTime });
        break;
        
      case 'MEDIA_PENDING':
      case 'MEDIA_APPROVED':
      case 'MEDIA_AUTO_APPROVED':
        if (webhookService.shouldProcess(parsed.notification_type, config)) {
          await webhookService.updateLog(logId, { status: 'processing' });
          
          // Run classification
          const classificationResult = await classificationService.classify(req.body);
          
          // Track the request
          await webhookService.trackRequest(parsed, classificationResult);
          
          // Update log
          await webhookService.updateLog(logId, {
            status: 'completed',
            classification_id: classificationResult.classification_id,
            routed_to_library: classificationResult.library,
            processing_time_ms: Date.now() - startTime
          });
          
          result = {
            success: true,
            notification_type: parsed.notification_type,
            classification_id: classificationResult.classification_id,
            library: classificationResult.library,
            confidence: classificationResult.confidence,
            method: classificationResult.method,
            reason: classificationResult.reason
          };
        } else {
          await webhookService.updateLog(logId, { status: 'skipped', processing_time_ms: Date.now() - startTime });
          result = { 
            success: true, 
            skipped: true, 
            reason: `Event type ${parsed.notification_type} is disabled` 
          };
        }
        break;
        
      case 'MEDIA_DECLINED':
        if (config.process_declined) {
          await webhookService.trackRequest(parsed, { declined: true });
          await webhookService.updateLog(logId, { status: 'completed', processing_time_ms: Date.now() - startTime });
        } else {
          await webhookService.updateLog(logId, { status: 'skipped', processing_time_ms: Date.now() - startTime });
        }
        result = { success: true, logged: true, declined: true };
        break;
        
      case 'MEDIA_AVAILABLE':
        await webhookService.updateRequestStatus(parsed, 'available');
        await webhookService.updateLog(logId, { status: 'completed', processing_time_ms: Date.now() - startTime });
        result = { success: true, status_updated: 'available' };
        break;
        
      case 'MEDIA_FAILED':
        await webhookService.updateRequestStatus(parsed, 'failed');
        await webhookService.updateLog(logId, { status: 'completed', processing_time_ms: Date.now() - startTime });
        
        // Notify on failure if configured
        if (config.notify_on_error && discordBot.isInitialized) {
          await discordBot.sendErrorNotification(`Media failed: ${parsed.subject}`, parsed);
        }
        
        result = { success: true, status_updated: 'failed' };
        break;
        
      default:
        logger.warn('Webhook', `Unknown notification type: ${parsed.notification_type}`);
        await webhookService.updateLog(logId, { status: 'completed', processing_time_ms: Date.now() - startTime });
        result = { 
          success: true, 
          unhandled: true,
          notification_type: parsed.notification_type 
        };
    }
    
    res.json(result);
    
  } catch (error) {
    logger.error('Webhook', `Processing error: ${error.message}`);
    
    if (logId) {
      await webhookService.updateLog(logId, {
        status: 'failed',
        error_message: error.message,
        processing_time_ms: Date.now() - startTime
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test webhook endpoint (for manual testing from UI)
 */
router.post('/test', async (req, res) => {
  try {
    const { notification_type = 'TEST_NOTIFICATION', media_type = 'movie', tmdb_id = 299536 } = req.body;
    
    // Create a mock Overseerr payload
    const mockPayload = {
      notification_type,
      event: 'Test Event',
      subject: notification_type === 'TEST_NOTIFICATION' ? 'Test Notification' : `Test ${media_type === 'movie' ? 'Movie' : 'TV'} Request`,
      message: 'This is a test webhook from Classifarr',
      media: {
        media_type,
        tmdbId: tmdb_id,
        status: 'pending'
      },
      request: {
        request_id: Date.now(),
        requestedBy_username: 'test_user',
        is4k: false
      }
    };
    
    // Process it
    const parsed = webhookService.parsePayload(mockPayload);
    const logId = await webhookService.logReceived(req, parsed);
    
    if (notification_type === 'TEST_NOTIFICATION') {
      await webhookService.updateLog(logId, { status: 'completed' });
      res.json({ success: true, message: 'Test webhook processed successfully' });
    } else {
      const result = await classificationService.classify(mockPayload);
      await webhookService.updateLog(logId, { status: 'completed', classification_id: result.classification_id });
      res.json({ success: true, ...result });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
