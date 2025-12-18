const rateLimit = require('express-rate-limit');
const authService = require('../services/auth');

/**
 * Middleware to verify JWT and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    const decoded = authService.verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Middleware to check specific permission
 */
const authorize = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get user permissions
      const permissions = await authService.getPermissions(req.user.role);
      
      if (!permissions) {
        return res.status(403).json({ error: 'Invalid role' });
      }
      
      // Check if user has the required permission
      if (!permissions[permission]) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission 
        });
      }
      
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(403).json({ error: 'Authorization failed' });
    }
  };
};

/**
 * Rate limiting for auth endpoints
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * More strict rate limiting for password reset
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: { error: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Optional authentication - attaches user if token provided, but doesn't fail if not
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = authService.verifyAccessToken(token);
      
      if (decoded) {
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          username: decoded.username,
          role: decoded.role
        };
      }
    }
    
    next();
  } catch (error) {
    // Don't fail on error, just continue without user
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authRateLimiter,
  passwordResetLimiter,
  optionalAuth
};
