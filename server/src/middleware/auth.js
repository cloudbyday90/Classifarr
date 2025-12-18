const authService = require('../services/auth');

/**
 * Middleware to verify JWT token
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Optional authentication - adds user to request if token is valid, but doesn't require it
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await authService.verifyToken(token);
      req.user = user;
    }
  } catch (error) {
    // Ignore invalid tokens for optional auth
  }
  next();
}

module.exports = {
  authenticateToken,
  requireAdmin,
  optionalAuth,
};
