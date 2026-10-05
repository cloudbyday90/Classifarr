/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { describeLiveMultiScaleRetry } from '../../services/liveMultiScaleDiagnostics.mjs';

test.each([
  ['busy', 'Another background job'],
  ['memory_pressure', 'protect memory'],
  ['memory_unknown', 'could not be verified'],
  ['unavailable', 'readiness check'],
])('explains deferred %s without arbitrary report fields', (reason, text) => {
  const result = describeLiveMultiScaleRetry({ status: 'deferred', reason, secret: 'PRIVATE' });
  expect(result).toEqual({ status: 'deferred', reason, recovery: expect.stringContaining(text) });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['PRIVATE\ncredential', undefined, {}, 'constructor'])('redacts unknown deferred reason %s', reason => {
  expect(describeLiveMultiScaleRetry({ status: 'deferred', reason })).toEqual({
    status: 'deferred', reason: 'unknown', recovery: expect.stringContaining('open a GitHub issue'),
  });
});

test.each(['disabled', 'waiting_for_libraries', 'waiting_for_inventory', 'ingesting', 'backfilling'])(
  'normal waiting %s needs no retry log', reason => {
    expect(describeLiveMultiScaleRetry({ status: 'deferred', reason })).toBeNull();
  });

test.each(['invalidated', 'capacity', 'degraded', 'unavailable'])('explains %s with fixed strings', status => {
  const result = describeLiveMultiScaleRetry({ status, reason: 'PRIVATE' });
  expect(result).toEqual({ status, reason: status, recovery: expect.any(String) });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

test.each(['ready', 'revalidated', 'cancelled', 'stopped', 'yielded', 'disabled', 'not_due', 'already_running', 'PRIVATE'])(
  'does not manufacture a retry for %s', status => {
    expect(describeLiveMultiScaleRetry({ status })).toBeNull();
  });

test.each([{ status: 'deferred', reason: 'unavailable' }, { status: 'unavailable' }])(
  'reports allowlisted stage and cause for unavailable %j', report => {
    expect(describeLiveMultiScaleRetry({ ...report, failure: { stage: 'readiness', code: 'database_schema', stack: 'PRIVATE' } })).toEqual({
      ...report, reason: 'unavailable', stage: 'readiness', code: 'database_schema', recovery: expect.stringContaining('migration diagnostics'),
    });
    const unknown = describeLiveMultiScaleRetry({ ...report, failure: { stage: 'PRIVATE', code: 'PRIVATE', recovery: 'PRIVATE' } });
    expect(unknown).toMatchObject({ stage: 'unknown', code: 'unknown', recovery: expect.stringContaining('open a GitHub issue') });
    expect(JSON.stringify(unknown)).not.toContain('PRIVATE');
  });
