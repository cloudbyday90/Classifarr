const express = require('express');
const authService = require('../services/auth');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// All user management routes require authentication and admin permission
router.use(authenticate);
router.use(authorize('can_manage_users'));

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (admin only)
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.is_active, u.must_change_password,
              u.failed_login_attempts, u.locked_until, u.last_login, u.last_password_change,
              u.created_at, u.updated_at
       FROM users u
       ORDER BY u.created_at DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create new user (admin only)
 */
router.post('/', async (req, res) => {
  try {
    const { email, username, password, role } = req.body;
    
    if (!email || !username || !password || !role) {
      return res.status(400).json({ error: 'Email, username, password, and role are required' });
    }
    
    // Validate password strength
    const validation = authService.validatePasswordStrength(password);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }
    
    // Validate role
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Hash password
    const passwordHash = await authService.hashPassword(password);
    
    // Create user
    const result = await db.query(
      `INSERT INTO users (email, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role, is_active, must_change_password, created_at`,
      [email, username, passwordHash, role]
    );
    
    // Audit log
    await authService.auditLog(result.rows[0].id, 'user_created', null, null, {
      created_by: req.user.userId
    });
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Email or username already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user details (admin only)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT u.id, u.email, u.username, u.role, u.is_active, u.must_change_password,
              u.failed_login_attempts, u.locked_until, u.last_login, u.last_password_change,
              u.created_at, u.updated_at
       FROM users u
       WHERE u.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user (admin only)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, username, role, is_active } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (username !== undefined) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    if (role !== undefined) {
      if (!['admin', 'editor', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, username, role, is_active, must_change_password, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Audit log
    await authService.auditLog(id, 'user_updated', null, null, {
      updated_by: req.user.userId,
      changes: req.body
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === '23505') {
      res.status(400).json({ error: 'Email or username already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user (soft delete - deactivate) (admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting yourself
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Soft delete - just deactivate
    const result = await db.query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Revoke all sessions
    await authService.revokeAllUserSessions(parseInt(id));
    
    // Audit log
    await authService.auditLog(parseInt(id), 'user_deleted', null, null, {
      deleted_by: req.user.userId
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password (admin only)
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    
    await authService.resetPassword(parseInt(id), newPassword, req.user.userId);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully. User will be required to change password on next login.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users/{id}/role:
 *   put:
 *     summary: Change user role (admin only)
 */
router.put('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Prevent changing your own role
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    const result = await db.query(
      `UPDATE users SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, username, role`,
      [role, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Audit log
    await authService.auditLog(parseInt(id), 'role_change', null, null, {
      changed_by: req.user.userId,
      new_role: role
    });
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users/{id}/audit:
 *   get:
 *     summary: Get user audit log (admin only)
 */
router.get('/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;
    
    const result = await db.query(
      `SELECT id, action, ip_address, user_agent, details, created_at
       FROM auth_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [id, parseInt(limit)]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/users/{id}/unlock:
 *   post:
 *     summary: Unlock locked user account (admin only)
 */
router.post('/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE users 
       SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, username`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Audit log
    await authService.auditLog(parseInt(id), 'account_unlocked', null, null, {
      unlocked_by: req.user.userId
    });
    
    res.json({ 
      success: true, 
      message: 'Account unlocked successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Unlock account error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
