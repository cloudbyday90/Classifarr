/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

import { profileUpdateLimiterConfig, generalAuthLimiterConfig } from '../config/rateLimits.mjs';

export function createUserRouter({
  express,
  rateLimit,
  db,
  auditLog,
  validatePasswordStrength,
  verifyPassword,
  hashPassword,
  authenticateToken,
}) {
  const router = express.Router();

  const profileUpdateLimiter = rateLimit(profileUpdateLimiterConfig);

  const authLimiter = rateLimit(generalAuthLimiterConfig);

  router.get('/me', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const result = await db.query(
      'SELECT id, username, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    return sendData(res, result.rows[0]);
  }));

  router.patch('/profile', authenticateToken, profileUpdateLimiter, asyncHandler(async (req, res) => {
    const { username } = req.body;

    if (!username || username.length < 3 || username.length > 50) {
      return sendError(res, 'Username must be between 3 and 50 characters');
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, req.user.id],
    );
    if (existing.rows.length > 0) {
      return sendError(res, 'Username already taken');
    }

    await db.query(
      'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
      [username, req.user.id],
    );

    await auditLog(
      req.user.id,
      'username_changed',
      req.ip,
      req.get('User-Agent'),
      { new_username: username },
    );

    return sendSuccess(res, { username });
  }));

  router.patch('/password', authenticateToken, profileUpdateLimiter, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendError(res, 'All password fields are required');
    }

    if (newPassword !== confirmPassword) {
      return sendError(res, 'Passwords do not match');
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return sendError(res, validation.message);
    }

    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id],
    );

    if (user.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const isValid = await verifyPassword(
      currentPassword,
      user.rows[0].password_hash,
    );

    if (!isValid) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    const newHash = await hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id],
    );

    await auditLog(
      req.user.id,
      'password_changed',
      req.ip,
      req.get('User-Agent'),
    );

    return sendSuccess(res, { message: 'Password updated successfully' });
  }));

  return router;
}
