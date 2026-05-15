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

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.code ? { code: this.code } : {}),
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 400, { code: code ?? 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
    this.extra = rest;
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.code ? { code: this.code } : {}),
      ...this.extra,
    };
  }
}

export class AuthenticationError extends AppError {
  constructor(message, { code } = {}) {
    super(message, 401, { code });
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message, { code } = {}) {
    super(message, 404, { code: code ?? 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 409, { code: code ?? 'CONFLICT' });
    this.name = 'ConflictError';
    this.extra = rest;
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.code ? { code: this.code } : {}),
      ...this.extra,
    };
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
