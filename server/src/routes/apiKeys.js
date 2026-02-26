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

const express = require('express');
const rateLimit = require('express-rate-limit');
const apiKeyService = require('../services/apiKeyService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Rate limiter for API key operations - prevent abuse
const apiKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 requests per window
  message: { error: 'Too many API key requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// All API key management endpoints require JWT authentication
// (only web UI users can manage keys)

/**
 * @swagger
 * /api/keys:
 *   post:
 *     summary: Create a new API key
 *     description: Creates a new API key and returns the full key
 *     NOTE: The full key is stored encrypted (not hashed) so users can view it again later
 */
router.post('/', authenticateToken, apiKeyLimiter, async (req, res) => {
  try {
    const { name, permissions, expires_at } = req.body;
    
    // Validate permissions
    if (permissions && !apiKeyService.VALID_PERMISSIONS.includes(permissions)) {
      return res.status(400).json({
        error: `Invalid permissions. Must be one of: ${apiKeyService.VALID_PERMISSIONS.join(', ')}`
      });
    }
    
    // Parse expiration date if provided
    let expiresAt = null;
    if (expires_at) {
      expiresAt = new Date(expires_at);
      if (isNaN(expiresAt.getTime())) {
        return res.status(400).json({ error: 'Invalid expiration date' });
      }
    }
    
    const apiKey = await apiKeyService.createApiKey(
      name || 'API Key',
      permissions || 'read_write',
      expiresAt
    );
    
    // Log key creation (prefix only)
    console.log(`API key created: ${apiKey.key_prefix}... by user ${req.user.username}`);
    
    res.json(apiKey);
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: List all API keys
 *     description: Returns masked keys (prefix only)
 */
router.get('/', authenticateToken, apiKeyLimiter, async (req, res) => {
  try {
    const keys = await apiKeyService.listApiKeys();
    res.json(keys);
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

/**
 * @swagger
 * /api/keys/:id/reveal:
 *   get:
 *     summary: Reveal the full API key
 *     description: |
 *       Returns the full decrypted API key for authenticated users.
 *       NOTE: This allows users to view their API keys again if they lose them.
 *       This is intentional - users should be able to retrieve their own keys.
 */
router.get('/:id/reveal', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if the key exists
    const apiKey = await apiKeyService.getApiKeyById(parseInt(id));
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    // Get the full decrypted key
    const fullKey = await apiKeyService.getApiKeyFull(parseInt(id));
    
    if (!fullKey) {
      return res.status(500).json({ error: 'Failed to retrieve API key' });
    }
    
    console.log(`API key revealed: ${apiKey.key_prefix}... by user ${req.user.username}`);
    
    res.json({ 
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey,
      key_prefix: apiKey.key_prefix,
      permissions: apiKey.permissions,
    });
  } catch (error) {
    console.error('Error revealing API key:', error);
    res.status(500).json({ error: 'Failed to reveal API key' });
  }
});

/**
 * @swagger
 * /api/keys/:id:
 *   patch:
 *     summary: Update API key metadata
 *     description: Can update name and active status
 */
router.patch('/:id', authenticateToken, apiKeyLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    const apiKey = await apiKeyService.updateApiKey(parseInt(id), updates);
    
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    console.log(`API key updated: ${apiKey.key_prefix}... by user ${req.user.username}`);
    
    res.json(apiKey);
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

/**
 * @swagger
 * /api/keys/:id:
 *   delete:
 *     summary: Revoke (delete) an API key
 */
router.delete('/:id', authenticateToken, apiKeyLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    
    const apiKey = await apiKeyService.getApiKeyById(parseInt(id));
    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    const deleted = await apiKeyService.deleteApiKey(parseInt(id));
    
    if (!deleted) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    console.log(`API key revoked: ${apiKey.key_prefix}... by user ${req.user.username}`);
    
    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
