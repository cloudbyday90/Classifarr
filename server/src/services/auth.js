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

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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
    console.error('Error getting JWT secret:', error);
    return process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
  }
}

async function generateAccessToken(user) {
  const secret = await getJWTSecret();

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    type: 'access'
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

async function generateRefreshToken(userId, userAgent = null, deviceInfo = null) {
  const tokenString = generateRefreshTokenString();
  const tokenHash = await hashToken(tokenString);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, device_info)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, deviceInfo ? JSON.stringify(deviceInfo) : null]
  );

  return tokenString;
}

async function validateRefreshToken(tokenString, userId = null) {
  const tokenHash = await hashToken(tokenString);
  
  let query = `SELECT id, user_id, expires_at, revoked_at 
          FROM refresh_tokens 
          WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`;
  const params = [tokenHash];
  
  if (userId) {
    query += ' AND user_id = $2';
    params.push(userId);
  }

  const result = await db.query(query, params);

  return result.rows.length > 0 ? result.rows[0] : null;
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

  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

async function auditLog(userId, action, ipAddress, userAgent, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  } catch (error) {
    console.error('AUDIT LOG FAILURE:', {
      userId,
      action,
      ipAddress,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

async function authenticate(identifier, password) {
  const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';

  const result = await db.query(query, [identifier]);

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  await db.query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  delete user.password_hash;

  return user;
}

function getCookieOptions(isSecure = false) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/'
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateAccessToken,
  generateRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  verifyToken,
  auditLog,
  authenticate,
  getJWTSecret,
  getCookieOptions,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
