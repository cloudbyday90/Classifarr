/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  loginLimiterConfig,
  refreshLimiterConfig,
  passwordChangeLimiterConfig,
  generalAuthLimiterConfig,
} from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';
import { sendData, sendSuccess, sendError } from '../utils/responseHelpers.mjs';

export function createAuthRouter({
  express,
  rateLimit,
  db,
  authenticate,
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  hashToken,
  auditLog,
  verifyPassword,
  hashPassword,
  validatePasswordStrength,
  getCookieOptions,
  getRefreshTokenCookieOptions,
  runtimeSettings,
  authenticateToken,
  issueCsrfToken,
  clearCsrfToken,
  resolveSecureCookieFlag,
}) {
  const router = express.Router();

  const loginLimiter = rateLimit(loginLimiterConfig);

  const refreshLimiter = rateLimit(refreshLimiterConfig);

  const passwordChangeLimiter = rateLimit(passwordChangeLimiterConfig);

  const authLimiter = rateLimit(generalAuthLimiterConfig);

  router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
    const { identifier, password, rememberMe } = req.body;
    const sanitizedRememberMe = rememberMe === true;

    if (!identifier || !password) {
      return sendError(res, 'Username and password are required');
    }

    let user;
    try {
      user = await authenticate(identifier, password);
    } catch (error) {
      return sendError(res, error.message, 401);
    }

    const accessToken = await generateAccessToken(user, sanitizedRememberMe);
    const refreshToken = await generateRefreshToken(
      user.id,
      req.get('User-Agent'),
      { ip: req.ip },
      sanitizedRememberMe,
    );

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', accessToken, getCookieOptions(secureCookies, sanitizedRememberMe));
    res.cookie('refresh_token', refreshToken, getRefreshTokenCookieOptions(secureCookies, sanitizedRememberMe));
    issueCsrfToken(res, req);

    await auditLog(user.id, 'login_success', req.ip, req.get('User-Agent'), { rememberMe: sanitizedRememberMe });

    return sendSuccess(res, {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  }));

  router.post('/refresh', refreshLimiter, asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required');
    }

    const tokenData = await validateRefreshToken(refreshToken);
    if (!tokenData) {
      return sendError(res, 'Invalid or expired refresh token', 401);
    }

    if (tokenData.compromised) {
      await revokeAllUserTokens(tokenData.user_id);
      await auditLog(
        tokenData.user_id,
        'token_replay_detected',
        req.ip,
        req.get('User-Agent'),
        { warning: 'All sessions revoked due to token replay' },
      );
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth' });
      return sendError(res, 'Session invalidated. Please log in again.', 401);
    }

    const userResult = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND is_active = true',
      [tokenData.user_id],
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found or inactive', 401);
    }

    const user = userResult.rows[0];
    const rememberMe = tokenData.remember_me || false;

    const newAccessToken = await generateAccessToken(user, rememberMe);
    const newRefreshToken = await generateRefreshToken(
      user.id,
      req.get('User-Agent'),
      { ip: req.ip },
      rememberMe,
      rememberMe ? tokenData.expires_at : null,
    );

    let revokedOldToken;
    try {
      revokedOldToken = await revokeRefreshToken(refreshToken, req.ip);
    } catch (error) {
      try { await revokeRefreshToken(newRefreshToken, req.ip); } catch (_e) { /* best effort */ }
      return sendError(res, error.message, 500);
    }

    if (!revokedOldToken) {
      await revokeRefreshToken(newRefreshToken, req.ip);
      return sendError(res, 'Invalid or expired refresh token', 401);
    }

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', newAccessToken, getCookieOptions(secureCookies, rememberMe));
    res.cookie('refresh_token', newRefreshToken, getRefreshTokenCookieOptions(secureCookies, rememberMe));
    issueCsrfToken(res, req);

    await auditLog(user.id, 'token_refresh', req.ip, req.get('User-Agent'));

    return sendSuccess(res, {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  }));

  router.post('/logout', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await revokeRefreshToken(refreshToken, req.ip);
    }

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/api/auth',
    });
    clearCsrfToken(res, req);

    await auditLog(req.user.id, 'logout', req.ip, req.get('User-Agent'));

    return sendSuccess(res);
  }));

  router.post('/logout-all', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const revokedCount = await revokeAllUserTokens(req.user.id);

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/api/auth',
    });
    clearCsrfToken(res, req);

    await auditLog(req.user.id, 'logout_all_devices', req.ip, req.get('User-Agent'), {
      tokensRevoked: revokedCount,
    });

    return sendSuccess(res, { tokensRevoked: revokedCount });
  }));

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

  router.post('/change-password', authenticateToken, passwordChangeLimiter, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return sendError(res, 'All password fields are required');
    }

    if (newPassword !== confirmPassword) {
      return sendError(res, 'New passwords do not match');
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return sendError(res, passwordValidation.message);
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    const valid = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    const newHash = await hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id],
    );

    const currentRefreshToken = req.cookies?.refresh_token;
    const currentTokenHash = currentRefreshToken
      ? await hashToken(currentRefreshToken)
      : null;
    const revokedCount = await revokeAllUserTokens(req.user.id, currentTokenHash);

    await auditLog(req.user.id, 'password_changed', req.ip, req.get('User-Agent'), {
      otherSessionsRevoked: revokedCount,
    });

    return sendSuccess(res, { message: 'Password changed successfully' });
  }));

  router.get('/session', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const user = await db.query(
      'SELECT last_login, created_at FROM users WHERE id = $1',
      [req.user.id],
    );

    if (user.rows.length === 0) {
      return sendError(res, 'User not found', 404);
    }

    return sendData(res, {
      started: user.rows[0].last_login,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
      createdAt: user.rows[0].created_at,
    });
  }));

  router.get('/sessions', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const result = await db.query(
      `SELECT id, user_agent, device_info, created_at, expires_at
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.id],
    );

    return sendData(res, { sessions: result.rows });
  }));

  router.delete('/sessions/:id', authenticateToken, authLimiter, asyncHandler(async (req, res) => {
    const sessionId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(sessionId)) {
      return sendError(res, 'Invalid session ID');
    }

    const result = await db.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), revoked_by_ip = $1
       WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
       RETURNING id`,
      [req.ip, sessionId, req.user.id],
    );

    if (result.rows.length === 0) {
      return sendError(res, 'Session not found or already revoked', 404);
    }

    return sendSuccess(res);
  }));

  return router;
}
