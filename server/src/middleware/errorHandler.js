const { createLogger } = require('../utils/logger');

const errorHandler = async (err, req, res, next) => {
  const logger = createLogger(req.path || 'ErrorHandler');
  
  const errorId = await logger.error(err.message, {
    stack: err.stack,
    code: err.code
  }, {
    req,
    stack: err.stack,
    metadata: {
      statusCode: err.statusCode || 500,
      errorCode: err.code
    }
  });

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal Server Error',
    errorId,  // Return error ID for user to reference in bug reports
    timestamp: new Date().toISOString()
  });
};

module.exports = errorHandler;
