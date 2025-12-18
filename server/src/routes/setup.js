const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../config/database');
const authService = require('../services/auth');

// Rate limiter for setup - 10 attempts per hour to prevent abuse
const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many setup attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Check if setup is required (no users exist)
 */
router.get('/status', async (req, res) => {
  try {
    const result = await db.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(result.rows[0].count);
    res.json({ 
      setupRequired: userCount === 0,
      setupComplete: userCount > 0
    });
  } catch (error) {
    // If table doesn't exist yet, setup is required
    res.json({ setupRequired: true, setupComplete: false });
  }
});

/**
 * Create initial admin account (only works if no users exist)
 */
router.post('/create-admin', setupLimiter, async (req, res) => {
  try {
    // Check if any users exist
    const countResult = await db.query('SELECT COUNT(*) FROM users');
    if (parseInt(countResult.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Setup already completed. Users already exist.' });
    }

    const { username, email, password, confirmPassword } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Create admin user
    const passwordHash = await authService.hashPassword(password);
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role, is_active, must_change_password)
       VALUES ($1, $2, $3, 'admin', true, false)
       RETURNING id, username, email, role`,
      [username, email, passwordHash]
    );

    // Log the setup completion
    await authService.auditLog(result.rows[0].id, 'setup_complete', req.ip, req.get('User-Agent'), {
      action: 'Initial admin account created'
    });

    // Generate token for immediate login
    const token = await authService.generateToken(result.rows[0]);

    res.json({ 
      success: true, 
      message: 'Admin account created successfully',
      user: result.rows[0],
      token
    });
  } catch (error) {
    console.error('Setup error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Failed to create admin account' });
  }
});

module.exports = router;
