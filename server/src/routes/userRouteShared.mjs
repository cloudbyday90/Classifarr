/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export function createUserRouter({
  express,
  rateLimit,
  db,
  authService,
  authenticateToken,
}) {
  const router = express.Router();

  const profileUpdateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Too many profile update attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (_req) => process.env.NODE_ENV === 'test',
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get('/me', authenticateToken, authLimiter, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT id, username, role, is_active, last_login, created_at FROM users WHERE id = $1',
        [req.user.id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.patch('/profile', authenticateToken, profileUpdateLimiter, async (req, res) => {
    try {
      const { username } = req.body;

      if (!username || username.length < 3 || username.length > 50) {
        return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
      }

      const existing = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, req.user.id],
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      await db.query(
        'UPDATE users SET username = $1, updated_at = NOW() WHERE id = $2',
        [username, req.user.id],
      );

      await authService.auditLog(
        req.user.id,
        'username_changed',
        req.ip,
        req.get('User-Agent'),
        { new_username: username },
      );

      return res.json({ success: true, username });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  router.patch('/password', authenticateToken, profileUpdateLimiter, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'All password fields are required' });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
      }

      const validation = authService.validatePasswordStrength(newPassword);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }

      const user = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id],
      );

      if (user.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const isValid = await authService.verifyPassword(
        currentPassword,
        user.rows[0].password_hash,
      );

      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const newHash = await authService.hashPassword(newPassword);
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, req.user.id],
      );

      await authService.auditLog(
        req.user.id,
        'password_changed',
        req.ip,
        req.get('User-Agent'),
      );

      return res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
