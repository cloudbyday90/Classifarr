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

const apiKeyService = require('../services/apiKeyService');
const authService = require('../services/auth');

/**
 * Middleware to authenticate API key from X-API-Key header
 * Adds apiKey object to request if valid
 */
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
    
    // Get client IP address
    const ip = req.ip || req.connection.remoteAddress;
    
    // Update last used timestamp and IP (non-blocking)
    // Track consecutive failures to detect persistent issues
    apiKeyService.updateLastUsed(validKey.id, ip).catch(err => {
      console.error('Error updating API key last used for key %s: %s', validKey.id, err.message);
      
      // Log additional warning if this appears to be a persistent issue
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.warn('Database connection issue detected while tracking API key usage. ' +
                     'Key %s usage tracking may be incomplete.', validKey.id);
      }
    });
    
    // Attach API key info to request
    req.apiKey = validKey;
    
    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Middleware to check for either JWT token or API key
 * Allows both authentication methods
 */
async function authenticateTokenOrApiKey(req, res, next) {
  // Check for API key first
  const apiKey = req.headers['x-api-key'];
  
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }
  
  // Fall back to JWT authentication
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const user = await authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to require read-write permissions
 * Must be used after authenticateApiKey or authenticateTokenOrApiKey
 */
function requireReadWrite(req, res, next) {
  // If authenticated via API key, check permissions
  if (req.apiKey && req.apiKey.permissions === 'read_only') {
    return res.status(403).json({ error: 'This endpoint requires read-write permissions' });
  }
  
  // If authenticated via JWT, allow (users have full access)
  next();
}

module.exports = {
  authenticateApiKey,
  authenticateTokenOrApiKey,
  requireReadWrite,
};
