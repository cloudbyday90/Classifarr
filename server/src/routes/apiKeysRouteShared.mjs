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
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendError } from '../utils/responseHelpers.mjs';
import { NotFoundError } from '../utils/appError.mjs';
import { requireValidId } from './routeHelpers.mjs';

export function createApiKeysRouter({
  express,
  rateLimit,
  validPermissions,
  createApiKey,
  listApiKeys,
  getApiKeyById,
  getApiKeyFull,
  updateApiKey,
  deleteApiKey,
  authenticateToken,
}) {
  const router = express.Router();

  const apiKeyLimiter = rateLimit(apiKeyLimiterConfig);

  router.post('/', authenticateToken, apiKeyLimiter, asyncHandler(async (req, res) => {
    const { name, permissions, expires_at: expiresAtInput } = req.body;

    if (permissions && !validPermissions.includes(permissions)) {
      throw new ValidationError(`Invalid permissions. Must be one of: ${validPermissions.join(', ')}`);
    }

    let expiresAt = null;
    if (expiresAtInput) {
      expiresAt = new Date(expiresAtInput);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new ValidationError('Invalid expiration date');
      }
    }

    const apiKey = await createApiKey(
      name || 'API Key',
      permissions || 'read_write',
      expiresAt,
    );

    return sendData(res, apiKey);
  }));

  router.get('/', authenticateToken, apiKeyLimiter, asyncHandler(async (_req, res) => {
    const keys = await listApiKeys();
    return sendData(res, keys);
  }));

  router.get('/:id/reveal', authenticateToken, asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'API key ID');
    const apiKey = await getApiKeyById(id);
    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    const fullKey = await getApiKeyFull(id);
    if (!fullKey) {
      return sendError(res, 'Failed to retrieve API key', 500);
    }

    return sendData(res, {
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey,
      key_prefix: apiKey.key_prefix,
      permissions: apiKey.permissions,
    });
  }));

  router.patch('/:id', authenticateToken, apiKeyLimiter, asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'API key ID');
    const { name, is_active: isActive } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.is_active = isActive;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    const apiKey = await updateApiKey(id, updates);
    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    return sendData(res, apiKey);
  }));

  router.delete('/:id', authenticateToken, apiKeyLimiter, asyncHandler(async (req, res) => {
    const id = requireValidId(req.params.id, 'API key ID');
    const apiKey = await getApiKeyById(id);
    if (!apiKey) {
      throw new NotFoundError('API key not found');
    }

    const deleted = await deleteApiKey(id);
    if (!deleted) {
      throw new NotFoundError('API key not found');
    }

    return sendData(res, { message: 'API key revoked successfully' });
  }));

  return router;
}
