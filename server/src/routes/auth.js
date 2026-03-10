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
const router = express.Router();
const db = require('../config/database');
const authService = require('../services/auth');
const runtimeSettings = require('../config/runtimeSettings');
const { authenticateToken } = require('../middleware/auth');
const { issueCsrfToken, clearCsrfToken } = require('../middleware/csrf');
const { resolveSecureCookieFlag } = require('../utils/cookieSecurity');

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

    const user = await authService.authenticate(identifier, password);
    const accessToken = await authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(
      user.id,
      req.get('User-Agent'),
      { ip: req.ip },
      sanitizedRememberMe
    );

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', accessToken, authService.getCookieOptions(secureCookies, sanitizedRememberMe));
    res.cookie('refresh_token', refreshToken, authService.getRefreshTokenCookieOptions(secureCookies, sanitizedRememberMe));
    issueCsrfToken(res, req);

    await authService.auditLog(user.id, 'login_success', req.ip, req.get('User-Agent'), { rememberMe: sanitizedRememberMe });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    await authService.auditLog(null, 'login_failed', req.ip, req.get('User-Agent'), {
      identifier: req.body.identifier
    });

    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

router.post('/refresh', refreshLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokenData = await authService.validateRefreshToken(refreshToken);
    if (!tokenData) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Replay attack: a known-revoked token was presented — likely token theft.
    // Revoke every active session for this user immediately.
    if (tokenData.compromised) {
      await authService.revokeAllUserTokens(tokenData.user_id);
      await authService.auditLog(
        tokenData.user_id,
        'token_replay_detected',
        req.ip,
        req.get('User-Agent'),
        { warning: 'All sessions revoked due to token replay' }
      );
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/api/auth' });
      return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
    }

    const userResult = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1 AND is_active = true',
      [tokenData.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = userResult.rows[0];
    const rememberMe = tokenData.remember_me || false;

    await authService.revokeRefreshToken(refreshToken, req.ip);

    const newAccessToken = await authService.generateAccessToken(user);
    const newRefreshToken = await authService.generateRefreshToken(
      user.id,
      req.get('User-Agent'),
      { ip: req.ip },
      rememberMe,
      // Sliding expiry: pass existing expiry so the 30-day window extends from
      // whichever is later — the old expiry or now — rather than always from now.
      rememberMe ? tokenData.expires_at : null
    );

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', newAccessToken, authService.getCookieOptions(secureCookies, rememberMe));
    res.cookie('refresh_token', newRefreshToken, authService.getRefreshTokenCookieOptions(secureCookies, rememberMe));
    issueCsrfToken(res, req);

    await authService.auditLog(user.id, 'token_refresh', req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(401).json({ error: error.message || 'Token refresh failed' });
  }
});

router.post('/logout', authenticateToken, authLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken, req.ip);
    }

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/api/auth'
    });
    clearCsrfToken(res, req);

    await authService.auditLog(req.user.id, 'logout', req.ip, req.get('User-Agent'));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout-all', authenticateToken, authLimiter, async (req, res) => {
  try {
    const revokedCount = await authService.revokeAllUserTokens(req.user.id);

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/'
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/api/auth'
    });
    clearCsrfToken(res, req);

    await authService.auditLog(req.user.id, 'logout_all_devices', req.ip, req.get('User-Agent'), {
      tokensRevoked: revokedCount
    });

    res.json({ success: true, tokensRevoked: revokedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticateToken, authLimiter, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    const passwordValidation = authService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await authService.verifyPassword(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await authService.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    // Revoke all other active sessions. If the user has a refresh token in this
    // request we keep it alive so they aren't immediately logged out; all other
    // devices are signed out immediately.
    const currentRefreshToken = req.cookies?.refresh_token;
    const currentTokenHash = currentRefreshToken
      ? await authService.hashToken(currentRefreshToken)
      : null;
    const revokedCount = await authService.revokeAllUserTokens(req.user.id, currentTokenHash);

    await authService.auditLog(req.user.id, 'password_changed', req.ip, req.get('User-Agent'), {
      otherSessionsRevoked: revokedCount
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/session', authenticateToken, authLimiter, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      started: user.rows[0].last_login,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('User-Agent'),
      createdAt: user.rows[0].created_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sessions', authenticateToken, authLimiter, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, user_agent, device_info, created_at, expires_at
       FROM refresh_tokens
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sessions/:id', authenticateToken, authLimiter, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const result = await db.query(
      `UPDATE refresh_tokens 
       SET revoked_at = NOW(), revoked_by_ip = $1
       WHERE id = $2 AND user_id = $3 AND revoked_at IS NULL
       RETURNING id`,
      [req.ip, sessionId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found or already revoked' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
