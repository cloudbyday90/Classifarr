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
const { issueCsrfToken } = require('../middleware/csrf');
const { resolveSecureCookieFlag } = require('../utils/cookieSecurity');

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many setup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/status', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(result.rows[0].count);
    res.json({
      setupRequired: userCount === 0,
      setupComplete: userCount > 0
    });
  } catch (error) {
    res.json({ setupRequired: true, setupComplete: false });
  }
});

router.post('/create-admin', setupLimiter, async (req, res) => {
  try {
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(countResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Setup already completed. Users already exist.' });
    }

    const { username, password, confirmPassword } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const passwordValidation = authService.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const passwordHash = await authService.hashPassword(password);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'admin', true, false)
       RETURNING id, username, role`,
      [username, passwordHash]
    );

    await authService.auditLog(result.rows[0].id, 'setup_complete', req.ip, req.get('User-Agent'), {
      action: 'Initial admin account created'
    });

    const accessToken = await authService.generateAccessToken(result.rows[0]);
    const refreshToken = await authService.generateRefreshToken(
      result.rows[0].id,
      req.get('User-Agent'),
      { ip: req.ip }
    );

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', accessToken, authService.getCookieOptions(secureCookies));
    issueCsrfToken(res, req);

    res.json({
      success: true,
      message: 'Admin account created successfully',
      user: result.rows[0],
      refreshToken
    });
  } catch (error) {
    console.error('Setup error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

module.exports = router;
