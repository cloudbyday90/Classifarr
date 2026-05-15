import { describe, it, expect, jest } from '@jest/globals';
import { asyncHandler } from '../utils/asyncHandler.mjs';

describe('asyncHandler', () => {
  function createMocks() {
    return {
      req: {},
      res: {},
      next: jest.fn(),
    };
  }

  it('calls the wrapped handler with req, res, next', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });

  it('does not call next when handler succeeds', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('calls next with error when handler throws synchronously', async () => {
    const error = new Error('sync fail');
    const handler = jest.fn().mockImplementation(() => {
      throw error;
    });
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('calls next with error when handler rejects', async () => {
    const error = new Error('async fail');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('preserves error properties when forwarding', async () => {
    const error = new Error('not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    const forwarded = next.mock.calls[0][0];
    expect(forwarded.statusCode).toBe(404);
    expect(forwarded.code).toBe('NOT_FOUND');
    expect(forwarded.message).toBe('not found');
  });

  it('works with handlers that return undefined', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMocks();

    await wrapped(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });
});
