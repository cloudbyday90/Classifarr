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

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  ACCESS_TOKEN_EXPIRY,
  SESSION_EXPIRY_HOURS,
  REMEMBER_ME_EXPIRY_DAYS,
  MAX_FAILED_LOGINS,
  LOCKOUT_DURATION_MINUTES,
  validatePasswordStrength,
  getCookieOptions,
  getRefreshTokenCookieOptions,
} from './authShared.mjs';
import {
  buildRefreshTokenInsertParams,
  buildRefreshTokenLookupQuery,
  generateRefreshTokenString,
  hashToken,
  resolveValidatedRefreshTokenRow,
  resolveRefreshTokenExpiry,
} from './authTokenShared.mjs';

const logger = createLogger('auth');

const SALT_ROUNDS = 12;
let nonPersistentAccessInvalidBeforeMs = Date.now();

const DUMMY_HASH = bcrypt.hashSync('dummy-timing-placeholder', SALT_ROUNDS);

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
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

async function generateRefreshToken(userId, userAgent = null, deviceInfo = null, rememberMe = false, slideFromDate = null) {
  const tokenString = generateRefreshTokenString();
  const tokenHash = await hashToken(tokenString);
  const expiresAt = resolveRefreshTokenExpiry(rememberMe, slideFromDate);
  const insertParams = buildRefreshTokenInsertParams({
    userId,
    tokenHash,
    expiresAt,
    userAgent,
    deviceInfo,
    rememberMe,
  });

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, device_info, remember_me)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    insertParams
  );

  return tokenString;
}

async function validateRefreshToken(tokenString, userId = null) {
  const tokenHash = await hashToken(tokenString);

  const { query, params } = buildRefreshTokenLookupQuery(tokenHash, userId);

  const lookupResult = await db.query(query, params);
  return resolveValidatedRefreshTokenRow(lookupResult.rows[0]);
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
    await bcrypt.compare(password, DUMMY_HASH);
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

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

  await db.query(
    'UPDATE users SET last_login = NOW(), failed_login_count = 0, locked_until = NULL WHERE id = $1',
    [user.id]
  );

  delete user.password_hash;

  return user;
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

export {
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
