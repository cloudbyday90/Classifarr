/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { webhookLimiterConfig } from '../config/rateLimits.mjs';

export function createWebhookLimiter(rateLimit) {
  return rateLimit(webhookLimiterConfig);
}

export function createHandleWebhook({ webhookService, queueService, logger }) {
  return async function handleWebhook(req, res) {
    const startTime = Date.now();
    let logId = null;

    try {
      const config = await webhookService.getConfig({ mask: false });

      if (!config.enabled) {
        logger.warn('Webhook disabled, rejecting request');
        return res.status(403).json({
          success: false,
          error: 'Webhook processing is disabled',
        });
      }

      const authKey = req.query.key
        || req.headers['x-webhook-key']
        || req.headers.authorization;

      if (!config.secret_key) {
        logger.warn('Webhook rejected: no secret_key configured');
        return res.status(401).json({
          success: false,
          error: 'Webhook secret not configured. Please set a secret key in webhook settings.',
        });
      }

      const isValidAuth = await webhookService.validateAuth(authKey, config);
      if (!isValidAuth) {
        logger.warn('Invalid webhook authentication', {
          providedKey: authKey ? 'present' : 'missing',
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook key',
        });
      }

      const { payload: sanitizedPayload, specialsExcluded } = webhookService.sanitizePayload(req.body, {
        includeSpecials: config.include_specials === true,
      });

      const parsed = webhookService.parsePayload(sanitizedPayload);
      logId = await webhookService.logReceived(req, parsed);
      if (specialsExcluded > 0) {
        logger.info('Excluded specials from webhook payload', {
          title: parsed.title,
          request_id: parsed.request_id,
          excluded_count: specialsExcluded,
        });
      }

      sanitizedPayload.include_specials = config.include_specials === true;

      switch (parsed.notification_type) {
        case 'TEST_NOTIFICATION':
        case 'test':
          await webhookService.updateLogStatus(logId, 'completed', { test: true });
          logger.info('Test webhook received');
          return res.json({
            success: true,
            message: 'Test webhook received successfully',
            logId,
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
          await webhookService.updateLogStatus(logId, 'skipped');
          logger.info('Unhandled webhook type', { notification_type: parsed.notification_type });
          return res.json({
            success: true,
            unhandled: true,
            notification_type: parsed.notification_type,
          });
      }

      logger.info('Enqueuing classification task', {
        notification_type: parsed.notification_type,
        media_type: parsed.media_type,
        title: parsed.title,
      });

      const taskId = await queueService.enqueue('classification', sanitizedPayload, {
        webhookLogId: logId,
        source: 'webhook',
        priority: parsed.notification_type.includes('AUTO') ? 1 : 0,
      });

      await webhookService.updateLogStatus(logId, 'queued', { taskId });

      logger.info('Webhook queued for processing', {
        logId,
        taskId,
        title: parsed.title,
        processingTime: `${Date.now() - startTime}ms`,
      });

      return res.status(202).json({
        success: true,
        queued: true,
        logId,
        taskId,
        message: 'Request queued for classification',
      });
    } catch (error) {
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack,
      });

      if (logId) {
        await webhookService.updateLogStatus(logId, 'failed', {
          error: error.message,
        }).catch((updateError) => {
          logger.error('Failed to update log status', { error: updateError.message });
        });
      }

      return res.status(500).json({
        success: false,
        error: error.message,
        logId,
      });
    }
  };
}

export function createWebhookRouter({
  express,
  rateLimit,
  webhookService,
  queueService,
  logger,
}) {
  const router = express.Router();
  const webhookLimiter = createWebhookLimiter(rateLimit);
  const handleWebhook = createHandleWebhook({ webhookService, queueService, logger });

  router.post('/request', webhookLimiter, handleWebhook);
  router.post('/overseerr', webhookLimiter, handleWebhook);

  return router;
}
