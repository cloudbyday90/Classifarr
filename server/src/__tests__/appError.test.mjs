import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableContentError,
  ServiceUnavailableError,
  isAppError,
} from '../utils/appError.mjs';

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
    expect(error.status).toBe(404);
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

  it('stores errorMessage separately from message', () => {
    const error = new AppError('test msg');
    expect(error.errorMessage).toBe('test msg');
    expect(error.message).toBe('test msg');
  });

  it('initializes extra as empty object', () => {
    const error = new AppError('test');
    expect(error.extra).toEqual({});
  });

  describe('toJSON()', () => {
    it('returns { error: message } by default', () => {
      const error = new AppError('base error');
      expect(error.toJSON()).toEqual({ error: 'base error' });
    });

    it('includes code when set', () => {
      const error = new AppError('fail', 500, { code: 'ERR_CODE' });
      expect(error.toJSON()).toEqual({ error: 'fail', code: 'ERR_CODE' });
    });

    it('omits code when undefined', () => {
      const error = new AppError('fail');
      expect(error.toJSON()).not.toHaveProperty('code');
    });

    it('spreads extra fields into response', () => {
      const error = new AppError('fail');
      error.extra = { detail: 'info', count: 3 };
      expect(error.toJSON()).toEqual({ error: 'fail', detail: 'info', count: 3 });
    });

    it('includes both code and extra fields', () => {
      const error = new AppError('fail', 500, { code: 'BOOM' });
      error.extra = { requestId: 'abc' };
      expect(error.toJSON()).toEqual({ error: 'fail', code: 'BOOM', requestId: 'abc' });
    });
  });
});

describe('ValidationError', () => {
  it('sets statusCode 400 and name', () => {
    const error = new ValidationError('bad input');
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('ValidationError');
    expect(error.isOperational).toBe(true);
  });

  it('stores extra fields on both this and this.extra', () => {
    const error = new ValidationError('bad', { field: 'email', maxLength: 50 });
    expect(error.field).toBe('email');
    expect(error.maxLength).toBe(50);
    expect(error.extra).toEqual({ field: 'email', maxLength: 50 });
  });

  it('extracts code from extra without putting it in extra', () => {
    const error = new ValidationError('bad', { code: 'INVALID_EMAIL', field: 'email' });
    expect(error.code).toBe('INVALID_EMAIL');
    expect(error.extra).toEqual({ field: 'email' });
    expect(error.toJSON()).toEqual({ error: 'bad', code: 'INVALID_EMAIL', field: 'email' });
  });

  it('toJSON returns { error: message } with no extra', () => {
    const error = new ValidationError('simple');
    expect(error.toJSON()).toEqual({ error: 'simple' });
  });
});

describe('AuthenticationError', () => {
  it('sets statusCode 401 and name', () => {
    const error = new AuthenticationError('bad creds');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AuthenticationError');
    expect(error.isOperational).toBe(true);
  });

  it('stores extra and includes in toJSON', () => {
    const error = new AuthenticationError('expired', { code: 'TOKEN_EXPIRED' });
    expect(error.code).toBe('TOKEN_EXPIRED');
    expect(error.toJSON()).toEqual({ error: 'expired', code: 'TOKEN_EXPIRED' });
  });
});

describe('ForbiddenError', () => {
  it('sets statusCode 403 and name', () => {
    const error = new ForbiddenError('no access');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(403);
    expect(error.name).toBe('ForbiddenError');
    expect(error.isOperational).toBe(true);
  });
});

describe('NotFoundError', () => {
  it('sets statusCode 404 and name', () => {
    const error = new NotFoundError('missing');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('NotFoundError');
    expect(error.isOperational).toBe(true);
  });

  it('stores extra fields in toJSON', () => {
    const error = new NotFoundError('gone', { resourceType: 'policy' });
    expect(error.toJSON()).toEqual({ error: 'gone', resourceType: 'policy' });
  });
});

describe('ConflictError', () => {
  it('sets statusCode 409 and name', () => {
    const error = new ConflictError('duplicate');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(error.name).toBe('ConflictError');
    expect(error.isOperational).toBe(true);
  });

  it('stores extra fields in toJSON', () => {
    const error = new ConflictError('running', { runId: 42 });
    expect(error.toJSON()).toEqual({ error: 'running', runId: 42 });
  });
});

describe('UnprocessableContentError', () => {
  it('sets statusCode 422 and preserves bounded error details', () => {
    const error = new UnprocessableContentError('payload differs', {
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(422);
    expect(error.name).toBe('UnprocessableContentError');
    expect(error.toJSON()).toEqual({
      error: 'payload differs',
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
  });
});

describe('ServiceUnavailableError', () => {
  it('sets statusCode 503 and name', () => {
    const error = new ServiceUnavailableError('not ready');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(503);
    expect(error.name).toBe('ServiceUnavailableError');
  });

  it('is always operational regardless of 5xx status', () => {
    const error = new ServiceUnavailableError('down');
    expect(error.isOperational).toBe(true);
  });

  it('stores extra fields in toJSON', () => {
    const error = new ServiceUnavailableError('cooldown', { retryAfter: '2026-05-26T20:00:00Z' });
    expect(error.toJSON()).toEqual({ error: 'cooldown', retryAfter: '2026-05-26T20:00:00Z' });
  });
});

describe('isAppError', () => {
  it('returns true for all AppError subclasses', () => {
    expect(isAppError(new ValidationError('v'))).toBe(true);
    expect(isAppError(new AuthenticationError('a'))).toBe(true);
    expect(isAppError(new ForbiddenError('f'))).toBe(true);
    expect(isAppError(new NotFoundError('n'))).toBe(true);
    expect(isAppError(new ConflictError('c'))).toBe(true);
    expect(isAppError(new UnprocessableContentError('u'))).toBe(true);
    expect(isAppError(new ServiceUnavailableError('s'))).toBe(true);
  });

  it('returns false for non-error primitives', () => {
    expect(isAppError('string')).toBe(false);
    expect(isAppError(42)).toBe(false);
    expect(isAppError(true)).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isAppError({})).toBe(false);
    expect(isAppError({ message: 'fake' })).toBe(false);
  });
});
