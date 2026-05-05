/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import apiKeyService from '../services/apiKeyService.mjs';
import { verifyToken } from '../services/auth.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('apiKeyAuth');

const WEBHOOK_ENDPOINTS = [
  '/api/webhook',
];

function isWebhookEndpoint(path) {
  return WEBHOOK_ENDPOINTS.some(ep => path.startsWith(ep));
}

function isReservedIntegrationKey(permission) {
  return permission === 'embed_service';
}

function ensureAuthenticatedPrincipal(req, res) {
  if (req.apiKey || req.user) {
    return true;
  }

  res.status(401).json({ error: 'Authentication required' });
  return false;
}

async function recordApiKeyUsage(apiKeyId, metadata) {
  const { endpoint, ipAddress, userAgent } = metadata;
  const results = await Promise.allSettled([
    apiKeyService.updateLastUsed(apiKeyId, ipAddress),
    apiKeyService.logAudit(apiKeyId, 'used', {
      endpoint,
      ipAddress,
      userAgent
    })
  ]);

  const [lastUsedResult, auditResult] = results;

  if (lastUsedResult.status === 'rejected') {
    logger.error('Error updating API key last used for key %s: %s', apiKeyId, lastUsedResult.reason.message);
  }

  if (auditResult.status === 'rejected') {
    logger.error('Error logging API key audit for key %s: %s', apiKeyId, auditResult.reason.message);
  }
}

async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const validKey = await apiKeyService.validateApiKey(apiKey);

    if (!validKey) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    if (isReservedIntegrationKey(validKey.permissions)) {
      return res.status(403).json({
        error: 'Embedding-service keys are reserved for sidecar authentication and cannot access Classifarr API endpoints.'
      });
    }

    const ip = req.ip || req.connection.remoteAddress;
    const endpoint = req.originalUrl || req.url;
    const userAgent = req.headers['user-agent'];

    await recordApiKeyUsage(validKey.id, {
      endpoint,
      ipAddress: ip,
      userAgent
    });

    req.apiKey = validKey;

    next();
  } catch (error) {
    logger.error('API key authentication error:', { error: error.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

async function authenticateTokenOrApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  try {
    let token = null;
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireReadWrite(req, res, next) {
  if (!ensureAuthenticatedPrincipal(req, res)) {
    return;
  }

  if (req.apiKey) {
    if (isReservedIntegrationKey(req.apiKey.permissions)) {
      return res.status(403).json({
        error: 'This endpoint requires a standard Classifarr API key. Embedding-service keys are reserved for sidecar authentication.'
      });
    }
    if (req.apiKey.permissions === 'read_only') {
      return res.status(403).json({ error: 'This endpoint requires read-write permissions' });
    }
    if (req.apiKey.permissions === 'webhook_only') {
      return res.status(403).json({ error: 'This endpoint requires read-write permissions. Webhook-only keys cannot access this endpoint.' });
    }
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!ensureAuthenticatedPrincipal(req, res)) {
    return;
  }

  if (req.apiKey) {
    if (req.apiKey.permissions !== 'admin') {
      return res.status(403).json({ error: 'This endpoint requires admin permissions' });
    }
  }

  if (req.user && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}

function requireWebhookOrAdmin(req, res, next) {
  if (!ensureAuthenticatedPrincipal(req, res)) {
    return;
  }

  if (req.apiKey) {
    if (req.apiKey.permissions === 'webhook_only' && !isWebhookEndpoint(req.originalUrl || req.url)) {
      return res.status(403).json({ error: 'Webhook-only keys can only access webhook endpoints' });
    }
  }

  next();
}

const apiKeyAuth = {
  authenticateApiKey,
  authenticateTokenOrApiKey,
  requireReadWrite,
  requireAdmin,
  requireWebhookOrAdmin,
  isReservedIntegrationKey,
};

export { authenticateApiKey, authenticateTokenOrApiKey, requireReadWrite, requireAdmin, requireWebhookOrAdmin, isReservedIntegrationKey };
export default apiKeyAuth;
