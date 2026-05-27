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
import { ValidationError } from '../utils/appError.mjs';
import { sendData, sendSuccess } from '../utils/responseHelpers.mjs';

async function getUserCount(db) {
  const result = await db.query('SELECT COUNT(*) FROM users');
  return Number.parseInt(result.rows[0].count, 10);
}

async function resolveSetupStatus(db) {
  try {
    const userCount = await getUserCount(db);
    return {
      setupRequired: userCount === 0,
      setupComplete: userCount > 0,
    };
  } catch (_error) {
    return { setupRequired: true, setupComplete: false };
  }
}

function validateCreateAdminRequest({
  username,
  password,
  confirmPassword,
  validatePasswordStrength,
}) {
  if (!username || !password) {
    throw new ValidationError('Username and password are required');
  }

  // eslint-disable-next-line security/detect-possible-timing-attacks -- comparing two user inputs from the same request
  if (password !== confirmPassword) {
    throw new ValidationError('Passwords do not match');
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new ValidationError(passwordValidation.message);
  }
}

async function insertInitialAdminUser({ db, username, passwordHash }) {
  try {
    const result = await db.query(
      `INSERT INTO users (username, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, 'admin', true, false)
       RETURNING id, username, role`,
      [username, passwordHash],
    );

    return result.rows[0];
  } catch (error) {
    if (error.code === '23505') {
      throw new ValidationError('Username already exists');
    }

    throw error;
  }
}

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
    return sendData(res, await resolveSetupStatus(db));
  }));

  router.post('/create-admin', setupLimiter, asyncHandler(async (req, res) => {
    if (await getUserCount(db) > 0) {
      throw new ValidationError('Setup already completed. Users already exist.');
    }

    const { username, password, confirmPassword } = req.body;
    validateCreateAdminRequest({
      username,
      password,
      confirmPassword,
      validatePasswordStrength,
    });

    const passwordHash = await hashPassword(password);
    const user = await insertInitialAdminUser({
      db,
      username,
      passwordHash,
    });

    await auditLog(user.id, 'setup_complete', req.ip, req.get('User-Agent'), {
      action: 'Initial admin account created',
    });

    const accessToken = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(
      user.id,
      req.get('User-Agent'),
      { ip: req.ip },
    );

    const secureCookies = resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies'));
    res.cookie('access_token', accessToken, getCookieOptions(secureCookies));
    issueCsrfToken(res, req);

    return sendSuccess(res, {
      message: 'Admin account created successfully',
      user,
      refreshToken,
    });
  }));

  return router;
}
