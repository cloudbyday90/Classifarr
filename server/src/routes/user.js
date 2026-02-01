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

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../config/database');
const authService = require('../services/auth');
const { authenticateToken } = require('../middleware/auth');

// Rate limiter for profile updates - 10 per hour
const profileUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many profile update attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
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

/**
 * Update username
 */
router.patch('/profile', authenticateToken, profileUpdateLimiter, async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    // Check if username already exists
    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    
    // Update username
    await db.query(
      'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
      [username, req.user.id]
    );
    
    // Audit log
    await authService.auditLog(
      req.user.id,
      'username_changed',
      req.ip,
      req.get('User-Agent'),
      { new_username: username }
    );
    
    res.json({ success: true, username });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Change password
 */
router.patch('/password', authenticateToken, profileUpdateLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    // Validate password strength
    const validation = authService.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }
    
    // Verify current password
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isValid = await authService.verifyPassword(
      currentPassword,
      user.rows[0].password_hash
    );
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash and update new password
    const newHash = await authService.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );
    
    // Audit log
    await authService.auditLog(
      req.user.id,
      'password_changed',
      req.ip,
      req.get('User-Agent')
    );
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
