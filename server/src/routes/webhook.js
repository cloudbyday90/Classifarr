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
const rateLimit = require('express-rate-limit');
const classificationService = require('../services/classification');
const webhookService = require('../services/webhook');
const queueService = require('../services/queueService');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('WebhookRoutes');

// Rate limiter for webhook endpoint - 100 requests per 15 minutes per IP
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, error: 'Too many webhook requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * /api/webhook/request:
 *   post:
 *     summary: Universal request manager webhook endpoint
 *     description: Receives media requests from Overseerr/Jellyseerr/Seer and classifies them
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Classification successful
 *       401:
 *         description: Invalid webhook key
 *       429:
 *         description: Too many requests
 *       500:
 *         description: Classification failed
 */

// Universal webhook handler - used by /request (new) and /overseerr (legacy)
const handleWebhook = async (req, res) => {
  const startTime = Date.now();
  let logId = null;

  try {
    // 1. Get config and validate auth
    const config = await webhookService.getConfig();

    if (!config.enabled) {
      logger.warn('Webhook disabled, rejecting request');
      return res.status(403).json({
        success: false,
        error: 'Webhook processing is disabled'
      });
    }

    const authKey = req.query.key || req.headers['x-webhook-key'];

    if (config.secret_key && !webhookService.validateAuth(authKey, config)) {
      logger.warn('Invalid webhook authentication', {
        providedKey: authKey ? 'present' : 'missing'
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook key'
      });
    }

    // 2. Parse payload and log receipt
    const parsed = webhookService.parsePayload(req.body);
    logId = await webhookService.logReceived(req, parsed);

    // 3. Handle by event type
    switch (parsed.notification_type) {
      case 'TEST_NOTIFICATION':
      case 'test':
        await webhookService.updateLogStatus(logId, 'completed', { test: true });
        logger.info('Test webhook received');
        return res.json({
          success: true,
          message: 'Test webhook received successfully',
          logId
        });

      case 'MEDIA_PENDING':
      case 'media.pending':
        if (!config.process_pending) {
          await webhookService.updateLogStatus(logId, 'skipped');
          logger.info('Pending webhook skipped by configuration');
          return res.json({ success: true, skipped: true, reason: 'Processing pending requests is disabled' });
        }
        break;

      case 'MEDIA_APPROVED':
      case 'media.approved':
        if (!config.process_approved) {
          await webhookService.updateLogStatus(logId, 'skipped');
          logger.info('Approved webhook skipped by configuration');
          return res.json({ success: true, skipped: true, reason: 'Processing approved requests is disabled' });
        }
        break;

      case 'MEDIA_AUTO_APPROVED':
      case 'media.auto_approved':
        if (!config.process_auto_approved) {
          await webhookService.updateLogStatus(logId, 'skipped');
          logger.info('Auto-approved webhook skipped by configuration');
          return res.json({ success: true, skipped: true, reason: 'Processing auto-approved requests is disabled' });
        }
        break;

      case 'MEDIA_DECLINED':
      case 'media.declined':
        if (!config.process_declined) {
          await webhookService.updateLogStatus(logId, 'skipped');
          logger.info('Declined webhook skipped by configuration');
          return res.json({ success: true, skipped: true, reason: 'Processing declined requests is disabled' });
        }
        await webhookService.updateRequestStatus(parsed, 'declined');
        await webhookService.updateLogStatus(logId, 'completed');
        return res.json({ success: true, status: 'declined' });

      case 'MEDIA_AVAILABLE':
      case 'media.available':
        await webhookService.updateRequestStatus(parsed, 'available');
        await webhookService.updateLogStatus(logId, 'completed');
        logger.info('Media marked as available', { title: parsed.title });
        return res.json({ success: true, status: 'available' });

      case 'MEDIA_FAILED':
      case 'media.failed':
        await webhookService.updateRequestStatus(parsed, 'failed');
        await webhookService.updateLogStatus(logId, 'completed');
        logger.info('Media marked as failed', { title: parsed.title });
        return res.json({ success: true, status: 'failed' });

      default:
        // Unknown event type
        await webhookService.updateLogStatus(logId, 'skipped');
        logger.info('Unhandled webhook type', { notification_type: parsed.notification_type });
        return res.json({
          success: true,
          unhandled: true,
          notification_type: parsed.notification_type
        });
    }

    // 4. For processable events (pending, approved, auto-approved), enqueue for classification
    logger.info('Enqueuing classification task', {
      notification_type: parsed.notification_type,
      media_type: parsed.media_type,
      title: parsed.title
    });

    // Enqueue task for background processing
    const taskId = await queueService.enqueue('classification', req.body, {
      webhookLogId: logId,
      source: 'webhook',
      priority: parsed.notification_type.includes('AUTO') ? 1 : 0  // Auto-approved slightly higher priority
    });

    // Update webhook log to show it's queued
    await webhookService.updateLogStatus(logId, 'queued', { taskId });

    logger.info('Webhook queued for processing', {
      logId,
      taskId,
      title: parsed.title,
      processingTime: `${Date.now() - startTime}ms`
    });

    // Return 202 Accepted - task will be processed in background
    res.status(202).json({
      success: true,
      queued: true,
      logId,
      taskId,
      message: 'Request queued for classification'
    });
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error.message,
      stack: error.stack
    });

    // Update log with error if we have a logId
    if (logId) {
      await webhookService.updateLogStatus(logId, 'failed', {
        error: error.message
      }).catch(err => {
        logger.error('Failed to update log status', { error: err.message });
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
      logId
    });
  }
};

// Register routes - both use the same handler since all request managers share the same format
router.post('/request', webhookLimiter, handleWebhook);  // New universal endpoint
router.post('/overseerr', webhookLimiter, handleWebhook); // Legacy endpoint (backward compatibility)

module.exports = router;
