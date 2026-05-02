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

const authService = require('../services/auth');

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }

  return null;
}

async function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    // A TokenExpiredError means the token was once valid but has passed its
    // 15-minute lifetime. Return 401 so the Axios interceptor on the client
    // silently calls /auth/refresh and retries — this is what makes Remember
    // Me sessions work after the short-lived access token expires.
    //
    // Any other error (JsonWebTokenError, wrong secret, malformed) returns 403
    // to signal a genuinely bad token that is not worth retrying.
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

async function optionalAuth(req, res, next) {
  try {
    const token = extractToken(req);

    if (token) {
      const user = await authService.verifyToken(token);
      req.user = user;
    }
  } catch (_error) {
    // Ignore invalid tokens for optional auth
  }
  next();
}

const authMiddleware = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
};

module.exports = authMiddleware;
module.exports.authenticateToken = authenticateToken;
module.exports.requireAdmin = requireAdmin;
module.exports.optionalAuth = optionalAuth;
module.exports.default = authMiddleware;
