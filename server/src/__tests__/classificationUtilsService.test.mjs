/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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

import { jest } from '@jest/globals';

let classificationUtilsService;

const mockOperationController = {
  OperationController: jest.fn().mockImplementation(({ timeout, mode } = {}) => ({
    _timeout: timeout,
    _mode: mode,
    run: jest.fn(async (fn, _label) => fn({ signal: null })),
  })),
};

const mockRagLoopHelpers = {
  classifyDbSqlState: jest.fn(),
  isRetryableDbConflictError: jest.fn(),
};

const mockLogger = {
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
};

await jest.unstable_mockModule('../utils/operationController.mjs', () => ({ ...mockOperationController, default: mockOperationController }));
await jest.unstable_mockModule('../utils/operationController.mjs', () => ({ ...mockOperationController, default: mockOperationController }));
await jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => ({ ...mockRagLoopHelpers, default: mockRagLoopHelpers }));
await jest.unstable_mockModule('../utils/ragLoopHelpers.mjs', () => ({ ...mockRagLoopHelpers, default: mockRagLoopHelpers }));
await jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

const { OperationController } = mockOperationController;
const {
  classifyDbSqlState,
  isRetryableDbConflictError,
} = mockRagLoopHelpers;

beforeAll(async () => {
  ({ default: classificationUtilsService } = await import('../services/classificationUtilsService.mjs'));
});

describe('resolveRagLoopTimeout', () => {
  test('adds 8000 ms to policy_recheck_metadata_timeout_ms', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout({ policy_recheck_metadata_timeout_ms: 2000 })).toBe(10000);
  });

  test('clamps result to RAG_LOOP_MAX_TIMEOUT_MS (15000)', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout({ policy_recheck_metadata_timeout_ms: 20000 })).toBe(15000);
  });

  test('clamps result to RAG_LOOP_MIN_TIMEOUT_MS (1000) when very small', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout({ policy_recheck_metadata_timeout_ms: -10000 })).toBe(1000);
  });

  test('defaults to 10000 when policy_recheck_metadata_timeout_ms is absent', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout({})).toBe(10000);
  });

  test('defaults to 10000 when config is omitted', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout()).toBe(10000);
  });

  test('treats non-numeric value as missing (defaults to 10000)', () => {
    expect(classificationUtilsService.resolveRagLoopTimeout({ policy_recheck_metadata_timeout_ms: 'fast' })).toBe(10000);
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    OperationController.mockImplementation(({ timeout, mode } = {}) => ({
      _timeout: timeout,
      _mode: mode,
      run: jest.fn(async (fn, _label) => fn({ signal: null })),
    }));
  });

  test('runs operation via OperationController when operationOrPromise is a function', async () => {
    const op = jest.fn().mockResolvedValue('result');
    const result = await classificationUtilsService.withTimeout(op, 5000, 'my_label');
    expect(result).toBe('result');
  });

  test('passes timeout label to OperationController.run', async () => {
    let capturedLabel;
    OperationController.mockImplementation(() => ({
      run: jest.fn(async (fn, label) => {
        capturedLabel = label;
        return fn({ signal: null });
      }),
    }));
    const op = jest.fn().mockResolvedValue('ok');
    await classificationUtilsService.withTimeout(op, 5000, 'rag_pass2_semantic_timeout');
    expect(capturedLabel).toBe('rag_pass2_semantic_timeout');
  });

  test('normalizes AbortError from OperationController into TimeoutError', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    abortErr.code = 'ABORT_ERR';
    OperationController.mockImplementation(() => ({
      run: jest.fn().mockRejectedValue(abortErr),
    }));

    await expect(
      classificationUtilsService.withTimeout(() => {}, 5000, 'my_timeout')
    ).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'my_timeout',
      code: 'ABORT_ERR',
    });
  });

  test('normalizes TimeoutError from OperationController preserving original code', async () => {
    const timeoutErr = new Error('unnamed timed out after 5000ms');
    timeoutErr.name = 'TimeoutError';
    timeoutErr.code = 'ETIMEDOUT';
    OperationController.mockImplementation(() => ({
      run: jest.fn().mockRejectedValue(timeoutErr),
    }));

    await expect(
      classificationUtilsService.withTimeout(() => {}, 5000, 'custom_msg')
    ).rejects.toMatchObject({ name: 'TimeoutError', message: 'custom_msg', code: 'ETIMEDOUT' });
  });

  test('re-throws non-timeout errors unchanged from OperationController', async () => {
    const domainErr = new Error('domain error');
    OperationController.mockImplementation(() => ({
      run: jest.fn().mockRejectedValue(domainErr),
    }));

    await expect(
      classificationUtilsService.withTimeout(() => {}, 5000, 'label')
    ).rejects.toThrow('domain error');
  });

  test('runs promise directly when operationOrPromise is already a Promise', async () => {
    const result = await classificationUtilsService.withTimeout(
      Promise.resolve('direct'),
      5000
    );
    expect(result).toBe('direct');
    expect(OperationController).not.toHaveBeenCalled();
  });

  test('resolves immediately without timeout when timeoutMs is 0', async () => {
    const op = jest.fn().mockResolvedValue('no-timeout');
    const result = await classificationUtilsService.withTimeout(op, 0);
    expect(result).toBe('no-timeout');
    expect(OperationController).not.toHaveBeenCalled();
  });

  test('resolves immediately without timeout when timeoutMs is negative', async () => {
    const op = jest.fn().mockResolvedValue('neg');
    const result = await classificationUtilsService.withTimeout(op, -1);
    expect(result).toBe('neg');
  });

  test('resolves immediately without timeout when timeoutMs is NaN', async () => {
    const op = jest.fn().mockResolvedValue('nan');
    const result = await classificationUtilsService.withTimeout(op, NaN);
    expect(result).toBe('nan');
  });

  test('uses default timeoutMessage when not provided', async () => {
    let capturedLabel;
    OperationController.mockImplementation(() => ({
      run: jest.fn(async (fn, label) => {
        capturedLabel = label;
        return fn({ signal: null });
      }),
    }));
    await classificationUtilsService.withTimeout(jest.fn().mockResolvedValue('x'), 5000);
    expect(capturedLabel).toBe('operation_timeout');
  });
});

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves after the specified delay', async () => {
    const promise = classificationUtilsService.sleep(500);
    jest.advanceTimersByTime(500);
    await promise;
  });

  test('resolves immediately for 0 ms', async () => {
    await expect(classificationUtilsService.sleep(0)).resolves.toBeUndefined();
  });

  test('resolves immediately for negative values', async () => {
    await expect(classificationUtilsService.sleep(-100)).resolves.toBeUndefined();
  });

  test('resolves immediately for NaN', async () => {
    await expect(classificationUtilsService.sleep(NaN)).resolves.toBeUndefined();
  });

  test('resolves immediately for non-numeric string', async () => {
    await expect(classificationUtilsService.sleep('fast')).resolves.toBeUndefined();
  });
});

describe('withRetryableDbConflict', () => {
  beforeEach(() => {
    classifyDbSqlState.mockReset().mockReturnValue({ sqlState: '23505', classCode: '23', retryable: false, reasonCode: 'db_integrity_violation' });
    isRetryableDbConflictError.mockReset().mockReturnValue(false);
  });

  test('returns result on first successful attempt', async () => {
    const op = jest.fn().mockResolvedValue('success');
    await expect(classificationUtilsService.withRetryableDbConflict(op)).resolves.toBe('success');
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('throws immediately for non-retryable errors', async () => {
    const err = new Error('integrity violation');
    const op = jest.fn().mockRejectedValue(err);
    await expect(classificationUtilsService.withRetryableDbConflict(op, { maxAttempts: 3 })).rejects.toThrow('integrity violation');
    expect(op).toHaveBeenCalledTimes(1);
  });

  test('retries on retryable conflict error and succeeds on second attempt', async () => {
    isRetryableDbConflictError.mockReturnValueOnce(true);
    classifyDbSqlState.mockReturnValue({ sqlState: '40001', classCode: '40', retryable: true, reasonCode: 'db_retryable_conflict' });
    const conflictErr = new Error('serialization failure');
    const op = jest.fn()
      .mockRejectedValueOnce(conflictErr)
      .mockResolvedValue('retried-ok');

    const result = await classificationUtilsService.withRetryableDbConflict(op, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('retried-ok');
    expect(op).toHaveBeenCalledTimes(2);
  });

  test('exhausts maxAttempts and throws last error', async () => {
    isRetryableDbConflictError.mockReturnValue(true);
    classifyDbSqlState.mockReturnValue({ sqlState: '40001', classCode: '40', retryable: true, reasonCode: 'db_retryable_conflict' });
    const conflictErr = new Error('always fails');
    const op = jest.fn().mockRejectedValue(conflictErr);

    await expect(
      classificationUtilsService.withRetryableDbConflict(op, { maxAttempts: 3, baseDelayMs: 1 }),
    ).rejects.toThrow('always fails');
    expect(op).toHaveBeenCalledTimes(3);
  });

  test('calls onRetry callback with correct context before each retry', async () => {
    isRetryableDbConflictError
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    classifyDbSqlState.mockReturnValue({ sqlState: '40001', classCode: '40', retryable: true, reasonCode: 'db_retryable_conflict' });
    const op = jest.fn()
      .mockRejectedValueOnce(new Error('conflict'))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();

    await classificationUtilsService.withRetryableDbConflict(op, {
      maxAttempts: 3,
      baseDelayMs: 1,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 1,
      maxAttempts: 3,
      sqlState: '40001',
      reasonCode: 'db_retryable_conflict',
    }));
  });

  test('defaults maxAttempts to 1 (no retries)', async () => {
    isRetryableDbConflictError.mockReturnValue(true);
    const err = new Error('fail');
    const op = jest.fn().mockRejectedValue(err);
    await expect(classificationUtilsService.withRetryableDbConflict(op)).rejects.toThrow('fail');
    expect(op).toHaveBeenCalledTimes(1);
  });
});

describe('isAiTransientAvailabilityError', () => {
  const transient = [
    ['HTTP 429 via response.status', { response: { status: 429 } }],
    ['HTTP 500 via response.status', { response: { status: 500 } }],
    ['HTTP 502 via response.status', { response: { status: 502 } }],
    ['HTTP 503 via response.status', { response: { status: 503 } }],
    ['HTTP 504 via response.status', { response: { status: 504 } }],
    ['ECONNREFUSED code', { code: 'ECONNREFUSED' }],
    ['ETIMEDOUT code', { code: 'ETIMEDOUT' }],
    ['ECONNRESET code', { code: 'ECONNRESET' }],
    ['EHOSTUNREACH code', { code: 'EHOSTUNREACH' }],
    ['ENOTFOUND code', { code: 'ENOTFOUND' }],
    ['ABORT_ERR code', { code: 'ABORT_ERR' }],
    ['ERR_CANCELED code', { code: 'ERR_CANCELED' }],
    ['ESTALL code', { code: 'ESTALL' }],
    ['EINCOMPLETE code', { code: 'EINCOMPLETE' }],
    ['message: rate limit', { message: 'rate limit exceeded' }],
    ['message: too many requests', { message: 'Too Many Requests' }],
    ['message: status code 429', { message: 'status code 429' }],
    ['message: status code 500', { message: 'status code 500' }],
    ['message: status code 502', { message: 'status code 502' }],
    ['message: status code 503', { message: 'status code 503' }],
    ['message: status code 504', { message: 'status code 504' }],
    ['message: timed out', { message: 'request timed out' }],
    ['message: ollama', { message: 'ollama unreachable' }],
    ['message: service unavailable', { message: 'service unavailable' }],
    ['message: model is busy', { message: 'model is busy right now' }],
    ['message: try again', { message: 'please try again later' }],
    ['message: stalled', { message: 'stream stalled' }],
    ['message: aborted', { message: 'request aborted' }],
    ['message: incomplete stream', { message: 'incomplete stream received' }],
    ['message: generation ended before completion signal', { message: 'generation ended before completion signal' }],
    ['message: budget exhausted', { message: 'budget exhausted' }],
    ['message: ai is not available', { message: 'ai is not available' }],
    ['message: providerlock', { message: 'providerlock timeout' }],
  ];

  test.each(transient)('%s → true', (_label, errorProps) => {
    const err = Object.assign(new Error(errorProps.message || 'err'), errorProps);
    expect(classificationUtilsService.isAiTransientAvailabilityError(err)).toBe(true);
  });

  test('returns false for a generic domain error', () => {
    expect(classificationUtilsService.isAiTransientAvailabilityError(new Error('invalid policy id'))).toBe(false);
  });

  test('returns false for null', () => {
    expect(classificationUtilsService.isAiTransientAvailabilityError(null)).toBe(false);
  });

  test('returns false for non-matching HTTP status code', () => {
    expect(classificationUtilsService.isAiTransientAvailabilityError({ response: { status: 404 } })).toBe(false);
  });
});

describe('buildParseDiagnostics', () => {
  test('returns correct shape with all defaults', () => {
    const result = classificationUtilsService.buildParseDiagnostics({
      mode: 'classify',
      attemptCount: 1,
    });
    expect(result).toEqual({
      contract_version: 'phase1_v1',
      mode: 'classify',
      attempt_count: 1,
      failure_reason: null,
      repaired: false,
      repair_attempted: false,
      repair_succeeded: false,
    });
  });

  test('includes failure_reason when provided', () => {
    const result = classificationUtilsService.buildParseDiagnostics({
      mode: 'verify',
      attemptCount: 2,
      failureReason: 'parse_format_mismatch',
    });
    expect(result.failure_reason).toBe('parse_format_mismatch');
  });

  test('sets repaired, repair_attempted, repair_succeeded when provided', () => {
    const result = classificationUtilsService.buildParseDiagnostics({
      mode: 'classify',
      attemptCount: 1,
      repaired: true,
      repairAttempted: true,
      repairSucceeded: true,
    });
    expect(result.repaired).toBe(true);
    expect(result.repair_attempted).toBe(true);
    expect(result.repair_succeeded).toBe(true);
  });

  test('contract_version is always phase1_v1', () => {
    const result = classificationUtilsService.buildParseDiagnostics({ mode: 'x', attemptCount: 0 });
    expect(result.contract_version).toBe('phase1_v1');
  });
});

describe('resolveRetryReason', () => {
  const cases = [
    ['EINCOMPLETE code', { code: 'EINCOMPLETE' }, 'ai_stream_incomplete'],
    ['completion signal message', { message: 'generation ended before completion signal' }, 'ai_stream_incomplete'],
    ['ESTALL code', { code: 'ESTALL' }, 'ai_stream_stalled'],
    ['stalled message', { message: 'stream stalled' }, 'ai_stream_stalled'],
    ['ABORT_ERR code', { code: 'ABORT_ERR' }, 'ai_stream_aborted'],
    ['ERR_CANCELED code', { code: 'ERR_CANCELED' }, 'ai_stream_aborted'],
    ['aborted message', { message: 'request aborted' }, 'ai_stream_aborted'],
    ['ETIMEDOUT code', { code: 'ETIMEDOUT' }, 'ai_timeout'],
    ['timed out message', { message: 'request timed out' }, 'ai_timeout'],
    ['status code 429 message', { message: 'status code 429' }, 'ai_rate_limited'],
    ['HTTP 429 response.status', { response: { status: 429 } }, 'ai_rate_limited'],
    ['status code 500 message', { message: 'status code 500' }, 'ai_server_error'],
    ['HTTP 500 response.status', { response: { status: 500 } }, 'ai_server_error'],
    ['status code 502 message', { message: 'status code 502' }, 'ai_gateway_error'],
    ['HTTP 502 response.status', { response: { status: 502 } }, 'ai_gateway_error'],
    ['status code 504 message', { message: 'status code 504' }, 'ai_gateway_error'],
    ['HTTP 504 response.status', { response: { status: 504 } }, 'ai_gateway_error'],
    ['status code 503 message', { message: 'status code 503' }, 'ai_unavailable'],
    ['HTTP 503 response.status', { response: { status: 503 } }, 'ai_unavailable'],
  ];

  test.each(cases)('%s → %s', (_label, errorProps, expectedCode) => {
    const err = Object.assign(new Error(errorProps.message || 'err'), errorProps);
    const result = classificationUtilsService.resolveRetryReason(err);
    expect(result.code).toBe(expectedCode);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test('falls back to ai_temporarily_unavailable for unknown error', () => {
    const result = classificationUtilsService.resolveRetryReason(new Error('some bizarre error'));
    expect(result.code).toBe('ai_temporarily_unavailable');
  });

  test('falls back to ai_temporarily_unavailable for null', () => {
    const result = classificationUtilsService.resolveRetryReason(null);
    expect(result.code).toBe('ai_temporarily_unavailable');
  });
});

describe('buildPendingRetryResult', () => {
  const RETRY_DELAY_MS = 5 * 60 * 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns correct base shape with defaults', () => {
    const result = classificationUtilsService.buildPendingRetryResult({});
    expect(result).toMatchObject({
      library: null,
      confidence: 0,
      method: 'queued_for_retry',
      needs_retry: true,
      libraries: [],
      signalContext: null,
      retry_count: 1,
      max_retries: 3,
    });
  });

  test('retry_after is RETRY_DELAY_MS in the future', () => {
    const now = Date.now();
    const result = classificationUtilsService.buildPendingRetryResult({});
    expect(result.retry_after.getTime()).toBe(now + RETRY_DELAY_MS);
  });

  test('increments retry_count by 1 from previousRetryCount', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ previousRetryCount: 2 });
    expect(result.retry_count).toBe(3);
  });

  test('null previousRetryCount normalises via Number(null)===0 → retry_count 1', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ previousRetryCount: null });
    expect(result.retry_count).toBe(1);
  });

  test('uses provided maxRetries', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ maxRetries: 5 });
    expect(result.max_retries).toBe(5);
  });

  test('defaults maxRetries to 3 for invalid value', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ maxRetries: 0 });
    expect(result.max_retries).toBe(3);
  });

  test('defaults maxRetries to 3 for non-numeric value', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ maxRetries: 'many' });
    expect(result.max_retries).toBe(3);
  });

  test('clips non-finite confidence to 0', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ confidence: NaN });
    expect(result.confidence).toBe(0);
  });

  test('passes confidence through when finite', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ confidence: 45 });
    expect(result.confidence).toBe(45);
  });

  test('passes libraries through', () => {
    const libs = [{ id: 1 }, { id: 2 }];
    const result = classificationUtilsService.buildPendingRetryResult({ libraries: libs });
    expect(result.libraries).toBe(libs);
  });

  test('passes signalContext through', () => {
    const ctx = { confidence: 70, suggestedLibrary: { id: 1 } };
    const result = classificationUtilsService.buildPendingRetryResult({ signalContext: ctx });
    expect(result.signalContext).toBe(ctx);
  });

  test('contains retry_reason_code from resolveRetryReason', () => {
    const err = Object.assign(new Error('aborted'), { code: 'ABORT_ERR' });
    const result = classificationUtilsService.buildPendingRetryResult({ transientError: err });
    expect(result.retry_reason_code).toBe('ai_stream_aborted');
  });

  test('uses ai_temporarily_unavailable retry_reason_code when no error provided', () => {
    const result = classificationUtilsService.buildPendingRetryResult({ transientError: null });
    expect(result.retry_reason_code).toBe('ai_temporarily_unavailable');
  });
});
