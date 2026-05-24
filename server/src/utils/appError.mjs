/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @typedef {{
 *   code?: string,
 *   isOperational?: boolean,
 * }} AppErrorOptions
 */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode=500]
   * @param {AppErrorOptions} [options={}]
   */
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    const { code, isOperational } = options;

    this.name = 'AppError';
    this.status = statusCode;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational ?? (statusCode < 500);
    /** @type {Record<string, unknown>} */
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
  /**
   * @param {string} message
   * @param {Record<string, unknown> & { code?: string }} [extra]
   */
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 400, { code });
    this.name = 'ValidationError';
    Object.assign(this, rest);
    this.extra = rest;
  }
}

export class AuthenticationError extends AppError {
  /**
   * @param {string} message
   * @param {Record<string, unknown> & { code?: string }} [extra]
   */
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 401, { code });
    this.name = 'AuthenticationError';
    Object.assign(this, rest);
    this.extra = rest;
  }
}

export class ForbiddenError extends AppError {
  /**
   * @param {string} message
   * @param {Record<string, unknown> & { code?: string }} [extra]
   */
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 403, { code });
    this.name = 'ForbiddenError';
    Object.assign(this, rest);
    this.extra = rest;
  }
}

export class NotFoundError extends AppError {
  /**
   * @param {string} message
   * @param {Record<string, unknown> & { code?: string }} [extra]
   */
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 404, { code });
    this.name = 'NotFoundError';
    Object.assign(this, rest);
    this.extra = rest;
  }
}

export class ConflictError extends AppError {
  /**
   * @param {string} message
   * @param {Record<string, unknown> & { code?: string }} [extra]
   */
  constructor(message, extra = {}) {
    const { code, ...rest } = extra;
    super(message, 409, { code });
    this.name = 'ConflictError';
    Object.assign(this, rest);
    this.extra = rest;
  }
}

/** @internal */
export function isAppError(error) {
  return error instanceof AppError;
}
