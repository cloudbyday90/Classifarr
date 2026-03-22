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

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('auth');

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const SESSION_EXPIRY_HOURS = 48;
const REMEMBER_ME_EXPIRY_DAYS = 30;
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_DURATION_MINUTES = 15;
let nonPersistentAccessInvalidBeforeMs = Date.now();

// Pre-computed at startup so authenticate() always spends ~the same time in
// bcrypt.compare regardless of whether the username exists. This prevents
// username enumeration via response-time differences.
const DUMMY_HASH = bcrypt.hashSync('dummy-timing-placeholder', SALT_ROUNDS);

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }

  return { valid: true };
}

async function getJWTSecret() {
  try {
    const result = await db.query(
      'SELECT secret FROM jwt_secrets WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      return result.rows[0].secret;
    }

    const secret = crypto.randomBytes(64).toString('hex');
    await db.query(
      'INSERT INTO jwt_secrets (secret, is_active) VALUES ($1, true)',
      [secret]
    );

    return secret;
  } catch (error) {
    logger.error('Error getting JWT secret:', { error: error.message });
    return process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
  }
}

async function generateAccessToken(user, rememberMe = false) {
  const secret = await getJWTSecret();
  const issuedAtMs = Date.now();

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    type: 'access',
    persistent_session: rememberMe,
    issued_at_ms: issuedAtMs
  };

  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'classifarr'
  });
}

function generateRefreshTokenString() {
  return crypto.randomBytes(48).toString('base64url');
}

async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function generateRefreshToken(userId, userAgent = null, deviceInfo = null, rememberMe = false, slideFromDate = null) {
  const tokenString = generateRefreshTokenString();
  const tokenHash = await hashToken(tokenString);
  
  const expiresAt = new Date();
  if (rememberMe) {
    // Sliding expiry: extend from the previous token's expiry if provided (keeps active
    // users from being logged out), otherwise start fresh from now.
    const base = slideFromDate ? new Date(Math.max(slideFromDate, Date.now())) : expiresAt;
    expiresAt.setTime(base.getTime());
    expiresAt.setDate(expiresAt.getDate() + REMEMBER_ME_EXPIRY_DAYS);
  } else {
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRY_HOURS);
  }

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, device_info, remember_me)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, tokenHash, expiresAt, userAgent, deviceInfo ? JSON.stringify(deviceInfo) : null, rememberMe]
  );

  return tokenString;
}

async function validateRefreshToken(tokenString, userId = null) {
  const tokenHash = await hashToken(tokenString);

  // Phase 1: look up the token regardless of revocation status so we can
  // distinguish a replay attack (known-revoked token) from a completely unknown token.
  let lookupQuery = `SELECT id, user_id, expires_at, revoked_at, remember_me
          FROM refresh_tokens
          WHERE token_hash = $1`;
  const lookupParams = [tokenHash];

  if (userId) {
    lookupQuery += ' AND user_id = $2';
    lookupParams.push(userId);
  }

  const lookupResult = await db.query(lookupQuery, lookupParams);

  if (lookupResult.rows.length === 0) {
    // Completely unknown token — not in the DB at all.
    return null;
  }

  const row = lookupResult.rows[0];

  if (row.revoked_at !== null) {
    // A known-revoked token was presented — almost certainly a replay attack.
    // Signal the caller to nuke all sessions for this user.
    return { compromised: true, user_id: row.user_id };
  }

  if (new Date(row.expires_at) <= new Date()) {
    // Token exists but has expired — treat as invalid (not a replay).
    return null;
  }

  return row;
}

async function revokeRefreshToken(tokenString, revokedByIp = null) {
  const tokenHash = await hashToken(tokenString);
  
  const result = await db.query(
    `UPDATE refresh_tokens 
     SET revoked_at = NOW(), revoked_by_ip = $1
     WHERE token_hash = $2 AND revoked_at IS NULL`,
    [revokedByIp, tokenHash]
  );

  return result.rowCount > 0;
}

async function revokeAllUserTokens(userId, exceptTokenHash = null) {
  let query = `UPDATE refresh_tokens 
               SET revoked_at = NOW() 
               WHERE user_id = $1 AND revoked_at IS NULL`;
  const params = [userId];

  if (exceptTokenHash) {
    query += ' AND token_hash != $2';
    params.push(exceptTokenHash);
  }

  const result = await db.query(query, params);
  return result.rowCount;
}

async function cleanupExpiredTokens() {
  const result = await db.query(
    `DELETE FROM refresh_tokens WHERE expires_at < NOW() AND revoked_at IS NULL`
  );
  return result.rowCount;
}

async function verifyToken(token) {
  const secret = await getJWTSecret();
  // Let the original JsonWebTokenError / TokenExpiredError propagate so callers
  // can distinguish an expired-but-valid token (retriable with a refresh token)
  // from a genuinely malformed / wrong-secret token (not retriable).
  const decoded = jwt.verify(token, secret);

  if (
    decoded?.type === 'access' &&
    decoded.persistent_session !== true &&
    typeof decoded.issued_at_ms === 'number' &&
    decoded.issued_at_ms < nonPersistentAccessInvalidBeforeMs
  ) {
    throw new jwt.TokenExpiredError('jwt expired', new Date(nonPersistentAccessInvalidBeforeMs));
  }

  return decoded;
}

async function auditLog(userId, action, ipAddress, userAgent, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  } catch (error) {
    logger.error('AUDIT LOG FAILURE:', {
      userId,
      action,
      ipAddress,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

async function authenticate(identifier, password) {
  const result = await db.query(
    'SELECT * FROM users WHERE username = $1 AND is_active = true',
    [identifier]
  );

  if (result.rows.length === 0) {
    // Always run bcrypt.compare even when the user doesn't exist so that
    // response time is identical to a wrong-password attempt, preventing
    // username enumeration via timing.
    await bcrypt.compare(password, DUMMY_HASH);
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  // Per-account lockout check — must come before the bcrypt work so a locked
  // account gets a clear message rather than a generic 'Invalid credentials'.
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remainingMs = new Date(user.locked_until) - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new Error(
      `Account temporarily locked due to too many failed login attempts. ` +
      `Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    // Atomically increment the counter and set locked_until once the threshold
    // is reached. The CASE keeps locked_until at its current value (NULL or an
    // already-expired timestamp) until the 10th failure.
    await db.query(
      `UPDATE users
       SET failed_login_count = failed_login_count + 1,
           locked_until = CASE
             WHEN failed_login_count + 1 >= $2
               THEN NOW() + ($3 || ' minutes')::INTERVAL
             ELSE locked_until
           END
       WHERE id = $1`,
      [user.id, MAX_FAILED_LOGINS, LOCKOUT_DURATION_MINUTES]
    );
    throw new Error('Invalid credentials');
  }

  // Successful login — reset lockout state and record last_login in one query.
  await db.query(
    'UPDATE users SET last_login = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );

  delete user.password_hash;

  return user;
}

function getCookieOptions(isSecure = false, rememberMe = false) {
  const maxAge = rememberMe
    ? REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    : SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function getRefreshTokenCookieOptions(isSecure = false, rememberMe = false) {
  const maxAge = rememberMe
    ? REMEMBER_ME_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    : SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/api/auth', // Scoped to auth routes only
    maxAge,
  };
}

async function revokeAllRefreshTokensOnStartup() {
  nonPersistentAccessInvalidBeforeMs = Date.now();
  const result = await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL AND remember_me = false`
  );
  return result.rowCount;
}

function getNonPersistentAccessInvalidBeforeMs() {
  return nonPersistentAccessInvalidBeforeMs;
}

module.exports = {
  hashPassword,
  hashToken,
  verifyPassword,
  validatePasswordStrength,
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  revokeAllRefreshTokensOnStartup,
  cleanupExpiredTokens,
  verifyToken,
  getNonPersistentAccessInvalidBeforeMs,
  auditLog,
  authenticate,
  getJWTSecret,
  getCookieOptions,
  getRefreshTokenCookieOptions,
  ACCESS_TOKEN_EXPIRY,
  SESSION_EXPIRY_HOURS,
  REMEMBER_ME_EXPIRY_DAYS,
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MINUTES,
};
