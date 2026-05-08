/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { apiKeyLimiterConfig } from '../config/rateLimits.mjs';

export function createApiKeysRouter({ express, rateLimit, apiKeyService, authenticateToken, createLogger }) {
  const logger = createLogger('apiKeys');
  const router = express.Router();

  const apiKeyLimiter = rateLimit(apiKeyLimiterConfig);

  router.post('/', authenticateToken, apiKeyLimiter, async (req, res) => {
    try {
      const { name, permissions, expires_at: expiresAtInput } = req.body;

      if (permissions && !apiKeyService.VALID_PERMISSIONS.includes(permissions)) {
        return res.status(400).json({
          error: `Invalid permissions. Must be one of: ${apiKeyService.VALID_PERMISSIONS.join(', ')}`,
        });
      }

      let expiresAt = null;
      if (expiresAtInput) {
        expiresAt = new Date(expiresAtInput);
        if (Number.isNaN(expiresAt.getTime())) {
          return res.status(400).json({ error: 'Invalid expiration date' });
        }
      }

      const apiKey = await apiKeyService.createApiKey(
        name || 'API Key',
        permissions || 'read_write',
        expiresAt,
      );

      logger.info(`API key created: ${apiKey.key_prefix}... by user ${req.user.username}`);
      return res.json(apiKey);
    } catch (error) {
      logger.error('Error creating API key:', { error: error.message });
      return res.status(500).json({ error: 'Failed to create API key' });
    }
  });

  router.get('/', authenticateToken, apiKeyLimiter, async (_req, res) => {
    try {
      const keys = await apiKeyService.listApiKeys();
      return res.json(keys);
    } catch (error) {
      logger.error('Error listing API keys:', { error: error.message });
      return res.status(500).json({ error: 'Failed to list API keys' });
    }
  });

  router.get('/:id/reveal', authenticateToken, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const apiKey = await apiKeyService.getApiKeyById(id);
      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      const fullKey = await apiKeyService.getApiKeyFull(id);
      if (!fullKey) {
        return res.status(500).json({ error: 'Failed to retrieve API key' });
      }

      logger.info(`API key revealed: ${apiKey.key_prefix}... by user ${req.user.username}`);

      return res.json({
        id: apiKey.id,
        name: apiKey.name,
        key: fullKey,
        key_prefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
      });
    } catch (error) {
      logger.error('Error revealing API key:', { error: error.message });
      return res.status(500).json({ error: 'Failed to reveal API key' });
    }
  });

  router.patch('/:id', authenticateToken, apiKeyLimiter, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const { name, is_active: isActive } = req.body;
      const updates = {};

      if (name !== undefined) updates.name = name;
      if (isActive !== undefined) updates.is_active = isActive;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const apiKey = await apiKeyService.updateApiKey(id, updates);
      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      logger.info(`API key updated: ${apiKey.key_prefix}... by user ${req.user.username}`);
      return res.json(apiKey);
    } catch (error) {
      logger.error('Error updating API key:', { error: error.message });
      return res.status(500).json({ error: 'Failed to update API key' });
    }
  });

  router.delete('/:id', authenticateToken, apiKeyLimiter, async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const apiKey = await apiKeyService.getApiKeyById(id);
      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      const deleted = await apiKeyService.deleteApiKey(id);
      if (!deleted) {
        return res.status(404).json({ error: 'API key not found' });
      }

      logger.info(`API key revoked: ${apiKey.key_prefix}... by user ${req.user.username}`);
      return res.json({ message: 'API key revoked successfully' });
    } catch (error) {
      logger.error('Error deleting API key:', { error: error.message });
      return res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });

  return router;
}