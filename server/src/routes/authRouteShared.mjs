/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

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

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many refresh attempts' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const passwordChangeLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Too many password change attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post('/login', loginLimiter, async (req, res) => {
    try {
      const { identifier, password, rememberMe } = req.body;
      const sanitizedRememberMe = rememberMe === true;

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await authenticate(identifier, password);
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

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      await auditLog(null, 'login_failed', req.ip, req.get('User-Agent'), {
        identifier: req.body.identifier,
      });

      return res.status(401).json({ error: error.message || 'Authentication failed' });
    }
  });

  router.post('/refresh', refreshLimiter, async (req, res) => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const tokenData = await validateRefreshToken(refreshToken);
      if (!tokenData) {
        return res.status(401).json({ error: 'Invalid or expired refresh token' });
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
        return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
      }

      const userResult = await db.query(
        'SELECT id, username, role FROM users WHERE id = $1 AND is_active = true',
        [tokenData.user_id],
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: 'User not found or inactive' });
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

      try {
        const revokedOldToken = await revokeRefreshToken(refreshToken, req.ip);
        if (!revokedOldToken) {
          await revokeRefreshToken(newRefreshToken, req.ip);
          return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
      } catch (rotationError) {
        await revokeRefreshToken(newRefreshToken, req.ip).catch(() => {}); // swallow-error: best-effort token revocation during rotation failure — must not mask the original error
        throw rotationError;
      }

      const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
      res.cookie('access_token', newAccessToken, getCookieOptions(secureCookies, rememberMe));
      res.cookie('refresh_token', newRefreshToken, getRefreshTokenCookieOptions(secureCookies, rememberMe));
      issueCsrfToken(res, req);

      await auditLog(user.id, 'token_refresh', req.ip, req.get('User-Agent'));

      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Token refresh failed' });
    }
  });

  router.post('/logout', authenticateToken, authLimiter, async (req, res) => {
    try {
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

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/logout-all', authenticateToken, authLimiter, async (req, res) => {
    try {
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

      return res.json({ success: true, tokensRevoked: revokedCount });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/me', authenticateToken, authLimiter, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, username, role, is_active, last_login, created_at FROM users WHERE id = $1',
        [req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.post('/change-password', authenticateToken, passwordChangeLimiter, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'All password fields are required' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
      }

      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const valid = await verifyPassword(currentPassword, userResult.rows[0].password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
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

      return res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/session', authenticateToken, authLimiter, async (req, res) => {
    try {
      const user = await db.query(
        'SELECT last_login, created_at FROM users WHERE id = $1',
        [req.user.id],
      );

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        started: user.rows[0].last_login,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        createdAt: user.rows[0].created_at,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.get('/sessions', authenticateToken, authLimiter, async (req, res) => {
    try {
      const result = await db.query(
        `SELECT id, user_agent, device_info, created_at, expires_at
         FROM refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC`,
        [req.user.id],
      );

      return res.json({ sessions: result.rows });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.delete('/sessions/:id', authenticateToken, authLimiter, async (req, res) => {
    try {
      const sessionId = Number.parseInt(req.params.id, 10);

      if (Number.isNaN(sessionId)) {
        return res.status(400).json({ error: 'Invalid session ID' });
      }

      const result = await db.query(
        `UPDATE refresh_tokens
         SET revoked_at = NOW(), revoked_by_ip = $1
         WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
         RETURNING id`,
        [req.ip, sessionId, req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Session not found or already revoked' });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
