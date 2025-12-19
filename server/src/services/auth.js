/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
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

/**
 * Generate or retrieve active JWT secret
 */
async function getJWTSecret() {
  try {
    // Check for active secret
    const result = await db.query(
      'SELECT secret FROM jwt_secrets WHERE is_active = true ORDER BY created_at DESC LIMIT 1'
    );

    if (result.rows.length > 0) {
      return result.rows[0].secret;
    }

    // Generate new secret
    const secret = crypto.randomBytes(64).toString('hex');
    await db.query(
      'INSERT INTO jwt_secrets (secret, is_active) VALUES ($1, true)',
      [secret]
    );

    return secret;
  } catch (error) {
    console.error('Error getting JWT secret:', error);
    // Fallback to environment variable or generate temporary one
    return process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
  }
}

/**
 * Generate JWT token for user
 */
async function generateToken(user) {
  const secret = await getJWTSecret();
  
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, secret, { 
    expiresIn: '7d',
    issuer: 'classifarr'
  });
}

/**
 * Verify JWT token
 */
async function verifyToken(token) {
  const secret = await getJWTSecret();
  
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Log audit event
 */
async function auditLog(userId, action, ipAddress, userAgent, metadata = {}) {
  try {
    await db.query(
      `INSERT INTO audit_log (user_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, JSON.stringify(metadata)]
    );
  } catch (error) {
    // Critical: Log to console as fallback when database logging fails
    console.error('AUDIT LOG FAILURE:', {
      userId,
      action,
      ipAddress,
      timestamp: new Date().toISOString(),
      error: error.message
    });
    // In production, this should also write to a file or external logging service
  }
}

/**
 * Authenticate user with username/email and password
 */
async function authenticate(identifier, password) {
  // Check if identifier is email or username
  // Basic email pattern check - looks for @ with chars on both sides
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  const query = isEmail
    ? 'SELECT * FROM users WHERE email = $1 AND is_active = true'
    : 'SELECT * FROM users WHERE username = $1 AND is_active = true';

  const result = await db.query(query, [identifier]);

  if (result.rows.length === 0) {
    throw new Error('Invalid credentials');
  }

  const user = result.rows[0];

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  await db.query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  // Remove password hash from returned user object
  delete user.password_hash;

  return user;
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  generateToken,
  verifyToken,
  auditLog,
  authenticate,
  getJWTSecret,
};
