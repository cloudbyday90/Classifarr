const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const authService = require('./auth');
const db = require('../config/database');

class InitializationService {
  constructor() {
    this.dataDir = process.env.DATA_DIR || '/app/data';
    this.jwtSecretFile = path.join(this.dataDir, 'jwt_secret');
    this.adminPasswordFile = path.join(this.dataDir, 'admin_password');
  }

  /**
   * Ensure data directory exists
   */
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      console.log(`Created data directory: ${this.dataDir}`);
    }
  }

  /**
   * Generate or load JWT secret
   */
  async initializeJWTSecret() {
    this.ensureDataDir();
    
    // Check if JWT secret already exists
    if (fs.existsSync(this.jwtSecretFile)) {
      const secret = fs.readFileSync(this.jwtSecretFile, 'utf8').trim();
      process.env.JWT_SECRET = secret;
      console.log('JWT secret loaded from file');
      return secret;
    }
    
    // Check if provided via environment
    if (process.env.JWT_SECRET) {
      console.log('JWT secret provided via environment variable');
      // Save to file for persistence
      fs.writeFileSync(this.jwtSecretFile, process.env.JWT_SECRET, { mode: 0o600 });
      return process.env.JWT_SECRET;
    }
    
    // Generate new secure JWT secret
    const secret = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(this.jwtSecretFile, secret, { mode: 0o600 });
    process.env.JWT_SECRET = secret;
    
    console.log('✅ Generated new JWT secret');
    return secret;
  }

  /**
   * Generate random password
   */
  generatePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    
    // Ensure password meets requirements
    password += 'A'; // Uppercase
    password += 'a'; // Lowercase
    password += '1'; // Number
    password += '!'; // Special char
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Create default admin user
   */
  async initializeAdminUser() {
    try {
      // Check if any users exist
      const result = await db.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(result.rows[0].count);
      
      if (userCount > 0) {
        console.log('Users already exist, skipping admin creation');
        return null;
      }
      
      // Generate random password
      const password = this.generatePassword(16);
      const passwordHash = await authService.hashPassword(password);
      
      // Create admin user
      const adminResult = await db.query(
        `INSERT INTO users (email, username, password_hash, role, must_change_password)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, username, role`,
        ['admin@classifarr.local', 'admin', passwordHash, 'admin', true]
      );
      
      const admin = adminResult.rows[0];
      
      // Save password to file (one-time)
      this.ensureDataDir();
      fs.writeFileSync(this.adminPasswordFile, password, { mode: 0o600 });
      
      // Display credentials
      console.log('\n' + '='.repeat(70));
      console.log('🔐 DEFAULT ADMIN CREDENTIALS (ONE-TIME DISPLAY)');
      console.log('='.repeat(70));
      console.log(`Email:    admin@classifarr.local`);
      console.log(`Username: admin`);
      console.log(`Password: ${password}`);
      console.log('='.repeat(70));
      console.log('⚠️  IMPORTANT: Change this password immediately after first login!');
      console.log(`📁 Password saved to: ${this.adminPasswordFile}`);
      console.log('='.repeat(70) + '\n');
      
      // Log to audit
      await authService.auditLog(admin.id, 'user_created', null, null, {
        created_by: 'system',
        first_run: true
      });
      
      return admin;
    } catch (error) {
      console.error('Failed to create admin user:', error);
      throw error;
    }
  }

  /**
   * Initialize all first-run tasks
   */
  async initialize() {
    try {
      console.log('🚀 Starting Classifarr initialization...\n');
      
      // Initialize JWT secret
      await this.initializeJWTSecret();
      
      // Initialize admin user
      const admin = await this.initializeAdminUser();
      
      if (admin) {
        console.log('✅ First-run setup completed successfully!\n');
      } else {
        console.log('✅ System already initialized\n');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check if system is initialized
   */
  async isInitialized() {
    try {
      // Check if JWT secret exists
      if (!fs.existsSync(this.jwtSecretFile) && !process.env.JWT_SECRET) {
        return false;
      }
      
      // Check if users exist
      const result = await db.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(result.rows[0].count);
      
      return userCount > 0;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new InitializationService();
