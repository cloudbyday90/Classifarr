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

const crypto = require('crypto');
const { constantTimeCompare } = require('../utils/encryption');
const runtimeSettings = require('../config/runtimeSettings');

const CSRF_COOKIE_NAME = 'classifarr_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    secure: runtimeSettings.getValue('force_secure_cookies'),
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
}

function clearCsrfToken(res) {
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions());
}

function ensureCsrfCookie(req, res, next) {
  const csrfEnabled = runtimeSettings.getValue('csrf_protection');
  if (!csrfEnabled) {
    return next();
  }

  const hasAccessTokenCookie = Boolean(req.cookies && req.cookies.access_token);
  const hasCsrfCookie = Boolean(req.cookies && req.cookies[CSRF_COOKIE_NAME]);

  if (hasAccessTokenCookie && !hasCsrfCookie) {
    issueCsrfToken(res);
  }

  return next();
}

function csrfProtection(req, res, next) {
  const csrfEnabled = runtimeSettings.getValue('csrf_protection');
  if (!csrfEnabled || SAFE_METHODS.has(req.method)) {
    return next();
  }

  const hasAccessTokenCookie = Boolean(req.cookies && req.cookies.access_token);
  if (!hasAccessTokenCookie) {
    return next();
  }

  if (req.headers['x-api-key']) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  const cookieToken = req.cookies && req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!cookieToken || !headerToken || typeof headerToken !== 'string') {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  if (!constantTimeCompare(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'CSRF validation failed' });
  }

  return next();
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  issueCsrfToken,
  clearCsrfToken,
  ensureCsrfCookie,
  csrfProtection,
};
