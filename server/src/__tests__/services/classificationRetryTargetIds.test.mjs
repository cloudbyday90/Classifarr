/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import { parseRetryTargetId, RETRY_TARGET_ID_VALIDATION_MESSAGE } from '../../services/classificationRetryTargetIds.mjs';
import { parseCanonicalDatabaseInt32Id } from '../../services/databaseIntegerValues.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

const unusedDb = { query: jest.fn(), withTransaction: jest.fn() };
jest.unstable_mockModule('../../config/database.mjs', () => ({ ...unusedDb, default: unusedDb }));
const { ClassificationRetryService } = await import('../../services/classificationRetryService.mjs');

describe('exact retry target admission', () => {
  test.each([[1, 1], ['1', 1], [100, 100], ['100', 100], ['2147483647', 2147483647],
    [2147483648, 2147483648], ['2147483648', 2147483648], [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    ['9007199254740992', '9007199254740992'], ['9007199254740993', '9007199254740993'],
    ['9223372036854775807', '9223372036854775807']])(
    'admits exact primitive %#', (input, expected) => { expect(parseRetryTargetId(input)).toBe(expected); });
  test.each([0, -0, -1, 1.5, NaN, Infinity, -Infinity,
    Number.MAX_SAFE_INTEGER + 1, 1e21, '', '0', '-0', '-1', '01', '00041', '+1', ' 1', '1 ', '1\n', '\n1',
    '1\t', '1.0', '1e2', '1e+2', '1E2', '1junk', '0x1', '1_0', '１２',
    '9223372036854775808', '9'.repeat(65536), null, undefined, true, false, 1n, Symbol('owned'),
    [], [1], [1, 2], {}, new Number(1), new String('1'), new Date('2026-01-01T00:00:00Z')])(
    'rejects unsupported primitive/shape %#', input => { expect(parseRetryTargetId(input)).toBeNull(); });
  test('does not invoke scalar coercion hooks or proxy traps', async () => {
    const hook = jest.fn(() => { throw new Error('Owned coercion must not run'); });
    const object = Object.defineProperties({}, { valueOf: { get: hook }, toString: { get: hook },
      [Symbol.toPrimitive]: { get: hook }, toJSON: { get: hook }, toPostgres: { get: hook } });
    const proxy = new Proxy({}, { get: hook, getPrototypeOf: hook, ownKeys: hook });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const value of [object, proxy, revoked.proxy]) {
      expect(parseRetryTargetId(value)).toBeNull();
      const db = { withTransaction: jest.fn() }, logger = createMockLogger(), eligibility = jest.fn(), recorder = jest.fn();
      const service = new ClassificationRetryService({ db, logger });
      const result = await service.retrySingle({ classificationId: value, retryEligibilityCheck: eligibility, retryReceiptRecorder: recorder });
      expect(result.failed).toBe(true); expect(result.reasonCode).toBe('retry_failed');
      expect(result.classificationId).toBe(value); expect(result.oldClassificationId).toBe(value);
      expect(db.withTransaction).not.toHaveBeenCalled(); expect(logger.info).not.toHaveBeenCalled(); expect(logger.error).not.toHaveBeenCalled();
      expect(eligibility).not.toHaveBeenCalled(); expect(recorder).not.toHaveBeenCalled();
    }
    expect(hook).not.toHaveBeenCalled();
  });
  test('normalizes a complete batch with numeric deduplication and input order', () => {
    const service = new ClassificationRetryService({ db: unusedDb, logger: createMockLogger() });
    expect(service.normalizeIds(['41', '9007199254740993', 1, 41, '9007199254740992', '1', '9007199254740993']))
      .toEqual({ error: null, ids: [41, '9007199254740993', 1, '9007199254740992'] });
    expect(service.normalizeIds([41, '1e2'])).toEqual({ error: RETRY_TARGET_ID_VALIDATION_MESSAGE, ids: [] });
    expect(service.normalizeIds(Array(1))).toEqual({ error: RETRY_TARGET_ID_VALIDATION_MESSAGE, ids: [] });
    expect(service.normalizeIds(Array(101).fill(1))).toEqual({ error: 'classificationIds exceeds maximum batch size (100)', ids: [] });
  });

  test('other INTEGER identities retain exact admission and their existing maximum', () => {
    expect(parseCanonicalDatabaseInt32Id('2147483647')).toBe(2147483647);
    for (const id of [2147483648, '2147483648', '00041', ' 41 ', '1e2']) {
      expect(parseCanonicalDatabaseInt32Id(id)).toBeNull();
    }
  });
});
