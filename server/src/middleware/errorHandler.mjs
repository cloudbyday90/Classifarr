/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ErrorHandler');

export function getStatusCode(err) {
  return err.statusCode || err.status || 500;
}

export function isMalformedJsonError(err, statusCode) {
  if (!err) return false;
  if (err.type === 'entity.parse.failed') return true;

  return (
    err instanceof SyntaxError &&
    statusCode === 400 &&
    typeof err.body === 'string'
  );
}

async function errorHandler(err, req, res, _next) {
  const statusCode = getStatusCode(err);
  const malformedJson = isMalformedJsonError(err, statusCode);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  if (malformedJson) {
    logger.info('Rejected malformed JSON payload', {
      name: err.name,
      statusCode,
      method: req.method,
      path: req.path,
      contentType: req.get('content-type'),
      parseError: err.message
    });

    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON payload. Ensure the request body is valid JSON.'
    });
  }

  const logFn = statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  const errorId = await logFn(
    err.message || 'Internal Server Error',
    {
      name: err.name,
      code: err.code,
      statusCode
    },
    {
      req,
      error: err
    }
  );

  const publicError = statusCode === 500 ? 'Internal Server Error' : err.message;
  const publicMessage = (statusCode >= 500 && isProduction)
    ? 'Internal Server Error'
    : err.message;

  return res.status(statusCode).json({
    error: publicError,
    message: publicMessage,
    ...(statusCode >= 500 && errorId ? { errorId } : {}),
    ...(isDevelopment && { stack: err.stack })
  });
}

export { errorHandler };
