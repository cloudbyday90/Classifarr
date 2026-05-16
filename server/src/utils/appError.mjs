/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, { code, isOperational } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational ?? (statusCode < 500);
    this.extra = {};

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.code ? { code: this.code } : {}),
      ...this.extra,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 400, { code });
    this.name = 'ValidationError';
    this.extra = rest;
  }
}

export class AuthenticationError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 401, { code });
    this.name = 'AuthenticationError';
    this.extra = rest;
  }
}

export class ForbiddenError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 403, { code });
    this.name = 'ForbiddenError';
    this.extra = rest;
  }
}

export class NotFoundError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 404, { code });
    this.name = 'NotFoundError';
    this.extra = rest;
  }
}

export class ConflictError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 409, { code });
    this.name = 'ConflictError';
    this.extra = rest;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
