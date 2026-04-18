/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

const apiKeyService = require('../services/apiKeyService');
const authService = require('../services/auth');
const { createLogger } = require('../utils/logger');

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
    
    apiKeyService.updateLastUsed(validKey.id, ip).catch(err => {
      logger.error('Error updating API key last used for key %s: %s', validKey.id, err.message);
    });
    
    apiKeyService.logAudit(validKey.id, 'used', {
      endpoint,
      ipAddress: ip,
      userAgent
    }).catch(err => {
      logger.error('Error logging API key audit:', err.message);
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
      token = authHeader && authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await authService.verifyToken(token);
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
  if (req.apiKey) {
    if (req.apiKey.permissions !== 'admin') {
      return res.status(403).json({ error: 'This endpoint requires admin permissions' });
    }
  }
  
  if (req.user) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  }
  
  next();
}

function requireWebhookOrAdmin(req, res, next) {
  if (req.apiKey) {
    if (req.apiKey.permissions === 'webhook_only' && !isWebhookEndpoint(req.originalUrl || req.url)) {
      return res.status(403).json({ error: 'Webhook-only keys can only access webhook endpoints' });
    }
  }
  
  next();
}

module.exports = {
  authenticateApiKey,
  authenticateTokenOrApiKey,
  requireReadWrite,
  requireAdmin,
  requireWebhookOrAdmin,
  isReservedIntegrationKey,
};
