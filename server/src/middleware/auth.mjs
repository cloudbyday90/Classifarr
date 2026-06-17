/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { verifyToken } from '../services/auth.mjs';

function isAllowedSweepPath(req, allowedPrefixes) {
  if (!Array.isArray(allowedPrefixes) || allowedPrefixes.length === 0) {
    return false;
  }

  const requestPath = req.originalUrl || req.url || '';
  return allowedPrefixes.some((prefix) =>
    typeof prefix === 'string' && requestPath.startsWith(prefix)
  );
}

/** @public */
export function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }

  return null;
}

export async function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await verifyToken(token);

    if (user?.token_use === 'local_ai_policy_sweep') {
      if (user.aud !== 'classifarr:local-ai-policy-sweep') {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      if (!isAllowedSweepPath(req, user.allowed_api_prefixes)) {
        return res.status(403).json({ error: 'Scoped token cannot access this endpoint' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}


