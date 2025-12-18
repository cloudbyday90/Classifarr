const express = require('express');
const authService = require('../services/auth');
const { authenticate, authRateLimiter, passwordResetLimiter } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 */
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const result = await authService.login(email, password, deviceInfo, ipAddress);
    
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and revoke refresh token
 */
router.post('/logout', authRateLimiter, authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    const ipAddress = req.ip || req.connection.remoteAddress;
    await authService.logout(refreshToken, ipAddress, req.user.userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token
 */
router.post('/refresh', authRateLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    const result = await authService.refreshAccessToken(refreshToken);
    
    res.json(result);
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change own password
 */
router.post('/change-password', passwordResetLimiter, authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    
    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user information
 */
router.get('/me', authRateLimiter, authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.is_active, u.must_change_password, 
              u.last_login, u.created_at, rp.*
       FROM users u
       LEFT JOIN role_permissions rp ON u.role = rp.role
       WHERE u.id = $1`,
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Extract permissions
    const permissions = {
      can_view_dashboard: user.can_view_dashboard,
      can_view_history: user.can_view_history,
      can_classify: user.can_classify,
      can_correct_classification: user.can_correct_classification,
      can_manage_libraries: user.can_manage_libraries,
      can_manage_settings: user.can_manage_settings,
      can_manage_users: user.can_manage_users,
      can_view_logs: user.can_view_logs,
      can_manage_webhooks: user.can_manage_webhooks
    };
    
    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.is_active,
      mustChangePassword: user.must_change_password,
      lastLogin: user.last_login,
      createdAt: user.created_at,
      permissions
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: List active sessions for current user
 */
router.get('/sessions', authRateLimiter, authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, device_info, ip_address, created_at, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/sessions/{id}:
 *   delete:
 *     summary: Revoke specific session
 */
router.delete('/sessions/:id', authRateLimiter, authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify session belongs to user
    const sessionResult = await db.query(
      'SELECT user_id FROM user_sessions WHERE id = $1',
      [id]
    );
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (sessionResult.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Cannot revoke another user\'s session' });
    }
    
    await authService.revokeSession(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/validate-password:
 *   post:
 *     summary: Validate password strength without changing it
 */
router.post('/validate-password', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const validation = authService.validatePasswordStrength(password);
    
    res.json(validation);
  } catch (error) {
    console.error('Validate password error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
