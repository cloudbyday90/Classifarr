/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('ErrorHandler');

/**
 * Global error handler middleware for Express
 * Catches all unhandled errors and persists them with full context
 */
async function errorHandler(err, req, res, next) {
  // Log error with full context
  const errorId = await logger.error(
    err.message || 'Internal Server Error',
    {
      name: err.name,
      code: err.code,
      statusCode: err.statusCode || 500
    },
    {
      req,
      error: err
    }
  );

  // Send response with error UUID for bug reporting
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal Server Error' : err.message,
    message: err.message,
    errorId: errorId || undefined,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;
