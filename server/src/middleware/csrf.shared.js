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
const { resolveSecureCookieFlag } = require('../utils/cookieSecurity');

const CSRF_COOKIE_NAME = 'classifarr_csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getCsrfCookieOptions(req) {
  return {
    httpOnly: false,
    secure: resolveSecureCookieFlag(req, runtimeSettings.getValue('force_secure_cookies')),
    sameSite: 'lax',
    // Match the maximum remember-me window (30 days). The CSRF token is not secret
    // (it is readable by JS by design), so a longer lifetime does not weaken security.
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function issueCsrfToken(res, req = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions(req));
  return token;
}

function clearCsrfToken(res, req = null) {
  res.clearCookie(CSRF_COOKIE_NAME, getCsrfCookieOptions(req));
}

function ensureCsrfCookie(req, res, next) {
  const csrfEnabled = runtimeSettings.getValue('csrf_protection');
  if (!csrfEnabled) {
    return next();
  }

  const hasAccessTokenCookie = Boolean(req.cookies && req.cookies.access_token);
  const hasCsrfCookie = Boolean(req.cookies && req.cookies[CSRF_COOKIE_NAME]);

  if (hasAccessTokenCookie && !hasCsrfCookie) {
    issueCsrfToken(res, req);
  }

  return next();
}

// Paths always exempt from CSRF (pre-authentication endpoints or self-protecting endpoints).
// This middleware is mounted at /api so req.path is relative — use paths without /api prefix.
//
// /auth/refresh is exempt because:
//   - the refresh token cookie is httpOnly + SameSite=lax, so browsers will not include
//     it in cross-site POST requests — CSRF is already impossible at the browser level
//   - requiring a CSRF cookie to refresh creates a chicken-and-egg problem when the
//     CSRF cookie has expired but the refresh token is still valid (remember-me sessions)
const CSRF_EXEMPT_PREFIXES = ['/setup', '/auth/refresh'];

function csrfProtection(req, res, next) {
  const csrfEnabled = runtimeSettings.getValue('csrf_protection');
  if (!csrfEnabled || SAFE_METHODS.has(req.method)) {
    return next();
  }

  // Setup routes are pre-authentication — always exempt.
  // A stale access_token cookie from a prior (wiped) install must not block admin account creation.
  if (CSRF_EXEMPT_PREFIXES.some(prefix => req.path.startsWith(prefix))) {
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

const csrfMiddleware = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  issueCsrfToken,
  clearCsrfToken,
  ensureCsrfCookie,
  csrfProtection,
};

module.exports = csrfMiddleware;
module.exports.CSRF_COOKIE_NAME = CSRF_COOKIE_NAME;
module.exports.CSRF_HEADER_NAME = CSRF_HEADER_NAME;
module.exports.issueCsrfToken = issueCsrfToken;
module.exports.clearCsrfToken = clearCsrfToken;
module.exports.ensureCsrfCookie = ensureCsrfCookie;
module.exports.csrfProtection = csrfProtection;
module.exports.default = csrfMiddleware;
