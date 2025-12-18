const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authService = require('../services/auth');
const { authenticateToken } = require('../middleware/auth');

/**
 * Login endpoint
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = await authService.authenticate(identifier, password);
    const token = await authService.generateToken(user);

    // Log successful login
    await authService.auditLog(user.id, 'login_success', req.ip, req.get('User-Agent'));

    res.json({
      success: true,
      user,
      token
    });
  } catch (error) {
    // Log failed login attempt
    await authService.auditLog(null, 'login_failed', req.ip, req.get('User-Agent'), {
      identifier: req.body.identifier
    });

    res.status(401).json({ error: error.message || 'Authentication failed' });
  }
});

/**
 * Get current user info
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM users WHERE id = $1',
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
 * Change password
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    // Validate new password strength
    const passwordValidation = authService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Get current user
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const valid = await authService.verifyPassword(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const newHash = await authService.hashPassword(newPassword);
    await db.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    // Log password change
    await authService.auditLog(req.user.id, 'password_changed', req.ip, req.get('User-Agent'));

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Logout (for audit log purposes)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await authService.auditLog(req.user.id, 'logout', req.ip, req.get('User-Agent'));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
