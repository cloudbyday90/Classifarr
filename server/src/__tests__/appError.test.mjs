import { describe, it, expect } from '@jest/globals';
import { AppError, isAppError } from '../utils/appError.mjs';

describe('AppError', () => {
  it('creates error with default statusCode 500', () => {
    const error = new AppError('something broke');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.message).toBe('something broke');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBeUndefined();
    expect(error.isOperational).toBe(false);
  });

  it('creates operational error for 4xx status codes', () => {
    const error = new AppError('not found', 404);
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it('creates non-operational error for 5xx status codes', () => {
    const error = new AppError('db crashed', 503);
    expect(error.statusCode).toBe(503);
    expect(error.isOperational).toBe(false);
  });

  it('accepts custom code and isOperational override', () => {
    const error = new AppError('validation failed', 400, {
      code: 'VALIDATION_ERROR',
      isOperational: false,
    });
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isOperational).toBe(false);
  });

  it('has a stack trace', () => {
    const error = new AppError('test');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('AppError');
  });

  it('isAppError returns true for AppError instances', () => {
    expect(isAppError(new AppError('test'))).toBe(true);
  });

  it('isAppError returns false for plain Error', () => {
    expect(isAppError(new Error('test'))).toBe(false);
  });

  it('isAppError returns false for null/undefined', () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError(undefined)).toBe(false);
  });
});
