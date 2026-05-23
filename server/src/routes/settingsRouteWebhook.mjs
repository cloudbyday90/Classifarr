/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function registerWebhookRoutes(router, { webhookHandlers }) {
  router.get('/webhook', webhookHandlers.getConfig);
  router.put('/webhook', webhookHandlers.updateConfig);
  router.post('/webhook/generate-key', webhookHandlers.generateKey);
  router.get('/webhook/secret', webhookHandlers.getSecret);
  router.get('/webhook/url', webhookHandlers.getUrl);
  router.get('/webhook/logs', webhookHandlers.getLogs);
  router.get('/webhook/stats', webhookHandlers.getStats);
  router.post('/webhook/test', webhookHandlers.sendTestWebhook);
  router.get('/webhook/configs', webhookHandlers.listConfigs);
  router.get('/webhook/configs/:id', webhookHandlers.getConfigById);
  router.post('/webhook/configs', webhookHandlers.createConfig);
  router.put('/webhook/configs/:id', webhookHandlers.updateConfigById);
  router.delete('/webhook/configs/:id', webhookHandlers.deleteConfig);
  router.post('/webhook/configs/:id/primary', webhookHandlers.setPrimaryConfig);
}
