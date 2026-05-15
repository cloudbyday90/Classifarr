/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setupLimiterConfig } from '../config/rateLimits.mjs';
import { asyncHandler } from '../utils/asyncHandler.mjs';

export function createSetupRouter({
  express,
  rateLimit,
  db,
  validatePasswordStrength,
  hashPassword,
  auditLog,
  generateAccessToken,
  generateRefreshToken,
  getCookieOptions,
  runtimeSettings,
  issueCsrfToken,
  resolveSecureCookieFlag,
}) {
  const router = express.Router();

  const setupLimiter = rateLimit(setupLimiterConfig);

  router.get('/status', asyncHandler(async (_req, res) => {
    try {
      const result = await db.query('SELECT COUNT(*) FROM users');
      const userCount = Number.parseInt(result.rows[0].count, 10);
      return res.json({
        setupRequired: userCount === 0,
        setupComplete: userCount > 0,
      });
    } catch (_error) {
      return res.json({ setupRequired: true, setupComplete: false });
    }
  }));

  router.post('/create-admin', setupLimiter, asyncHandler(async (req, res) => {
    try {
      const countResult = await db.query('SELECT COUNT(*) FROM users');
      if (Number.parseInt(countResult.rows[0].count, 10) > 0) {
        return res.status(400).json({ error: 'Setup already completed. Users already exist.' });
      }

      const { username, password, confirmPassword } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.message });
      }

      const passwordHash = await hashPassword(password);
      const result = await db.query(
        `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
         VALUES ($1, $2, 'admin', true, false)
         RETURNING id, username, role`,
        [username, passwordHash],
      );

      await auditLog(result.rows[0].id, 'setup_complete', req.ip, req.get('User-Agent'), {
        action: 'Initial admin account created',
      });

      const accessToken = await generateAccessToken(result.rows[0]);
      const refreshToken = await generateRefreshToken(
        result.rows[0].id,
        req.get('User-Agent'),
        { ip: req.ip },
      );

      const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
      res.cookie('access_token', accessToken, getCookieOptions(secureCookies));
      issueCsrfToken(res, req);

      return res.json({
        success: true,
        message: 'Admin account created successfully',
        user: result.rows[0],
        refreshToken,
      });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Username already exists' });
      }
      throw error;
    }
  }));

  return router;
}
