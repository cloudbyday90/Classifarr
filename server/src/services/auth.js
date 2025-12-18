const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/database');

class AuthService {
  constructor() {
    this.SALT_ROUNDS = 12;
    this.ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS) || 7;
    this.MAX_FAILED_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    this.LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 15;
    this.JWT_SECRET = process.env.JWT_SECRET;
    
    if (!this.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };
    
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY
    });
  }

  /**
   * Generate secure refresh token
   */
  generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Hash refresh token for storage
   */
  async hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Create new session with refresh token
   */
  async createSession(userId, refreshToken, deviceInfo, ipAddress) {
    const tokenHash = await this.hashRefreshToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRY_DAYS);
    
    const result = await db.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, device_info, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, tokenHash, deviceInfo, ipAddress, expiresAt]
    );
    
    return result.rows[0].id;
  }

  /**
   * Validate refresh token and get user
   */
  async validateRefreshToken(token) {
    const tokenHash = await this.hashRefreshToken(token);
    
    const result = await db.query(
      `SELECT s.*, u.id as user_id, u.email, u.username, u.role, u.is_active, u.must_change_password
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.refresh_token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.is_active = true`,
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId) {
    await db.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId) {
    await db.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  /**
   * Check if account is locked
   */
  async checkAccountLocked(user) {
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesRemaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return {
        locked: true,
        minutesRemaining
      };
    }
    return { locked: false };
  }

  /**
   * Record failed login attempt
   */
  async recordFailedLogin(userId, ipAddress) {
    const lockoutInterval = `${this.LOCKOUT_DURATION_MINUTES} minutes`;
    const result = await db.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE 
             WHEN failed_login_attempts + 1 >= $1 
             THEN NOW() + $3::interval
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING failed_login_attempts, locked_until`,
      [this.MAX_FAILED_ATTEMPTS, userId, lockoutInterval]
    );
    
    await this.auditLog(userId, 'failed_login', ipAddress, null, {
      attempts: result.rows[0].failed_login_attempts
    });
    
    return result.rows[0];
  }

  /**
   * Record successful login
   */
  async recordSuccessfulLogin(userId, ipAddress) {
    await db.query(
      `UPDATE users 
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
    
    await this.auditLog(userId, 'login', ipAddress, null, null);
  }

  /**
   * Login user
   */
  async login(email, password, deviceInfo, ipAddress) {
    // Get user
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      throw new Error('Invalid email or password');
    }
    
    const user = userResult.rows[0];
    
    // Check if account is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }
    
    // Check if account is locked
    const lockStatus = await this.checkAccountLocked(user);
    if (lockStatus.locked) {
      throw new Error(`Account is locked. Try again in ${lockStatus.minutesRemaining} minutes`);
    }
    
    // Verify password
    const validPassword = await this.verifyPassword(password, user.password_hash);
    
    if (!validPassword) {
      await this.recordFailedLogin(user.id, ipAddress);
      
      const updatedUser = await db.query('SELECT failed_login_attempts FROM users WHERE id = $1', [user.id]);
      const attemptsRemaining = this.MAX_FAILED_ATTEMPTS - updatedUser.rows[0].failed_login_attempts;
      
      if (attemptsRemaining > 0) {
        throw new Error(`Invalid email or password. ${attemptsRemaining} attempts remaining`);
      } else {
        throw new Error(`Account locked due to too many failed attempts. Try again in ${this.LOCKOUT_DURATION_MINUTES} minutes`);
      }
    }
    
    // Record successful login
    await this.recordSuccessfulLogin(user.id, ipAddress);
    
    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();
    
    // Create session
    const sessionId = await this.createSession(user.id, refreshToken, deviceInfo, ipAddress);
    
    return {
      accessToken,
      refreshToken,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        mustChangePassword: user.must_change_password
      }
    };
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken, ipAddress, userId) {
    const tokenHash = await this.hashRefreshToken(refreshToken);
    
    await db.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token_hash = $1`,
      [tokenHash]
    );
    
    if (userId) {
      await this.auditLog(userId, 'logout', ipAddress, null, null);
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    const session = await this.validateRefreshToken(refreshToken);
    
    if (!session) {
      throw new Error('Invalid or expired refresh token');
    }
    
    const user = {
      id: session.user_id,
      email: session.email,
      username: session.username,
      role: session.role
    };
    
    const accessToken = this.generateAccessToken(user);
    
    return {
      accessToken,
      user: {
        ...user,
        mustChangePassword: session.must_change_password
      }
    };
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    // Get user
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = userResult.rows[0];
    
    // Verify current password
    const validPassword = await this.verifyPassword(currentPassword, user.password_hash);
    
    if (!validPassword) {
      throw new Error('Current password is incorrect');
    }
    
    // Validate new password strength
    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);
    
    // Update password
    await db.query(
      `UPDATE users 
       SET password_hash = $1,
           must_change_password = false,
           last_password_change = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, userId]
    );
    
    // Revoke all existing sessions (force re-login)
    await this.revokeAllUserSessions(userId);
    
    await this.auditLog(userId, 'password_change', null, null, null);
  }

  /**
   * Reset password (admin only)
   */
  async resetPassword(userId, newPassword, adminId) {
    // Validate new password strength
    const validation = this.validatePasswordStrength(newPassword);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }
    
    // Hash new password
    const newPasswordHash = await this.hashPassword(newPassword);
    
    // Update password and force change
    await db.query(
      `UPDATE users 
       SET password_hash = $1,
           must_change_password = true,
           last_password_change = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, userId]
    );
    
    // Revoke all existing sessions
    await this.revokeAllUserSessions(userId);
    
    await this.auditLog(userId, 'password_reset', null, null, { reset_by: adminId });
  }

  /**
   * Audit log
   */
  async auditLog(userId, action, ipAddress, userAgent, details) {
    await db.query(
      `INSERT INTO auth_audit_log (user_id, action, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, ipAddress, userAgent, details ? JSON.stringify(details) : null]
    );
  }

  /**
   * Verify JWT token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user permissions by role
   */
  async getPermissions(role) {
    const result = await db.query(
      'SELECT * FROM role_permissions WHERE role = $1',
      [role]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
}

module.exports = new AuthService();
