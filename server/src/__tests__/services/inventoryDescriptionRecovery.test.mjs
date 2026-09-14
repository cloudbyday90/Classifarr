/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createInventoryDescriptionRecovery } from '../../services/inventoryDescriptionRecovery.mjs';
import { diagnoseProviderResponse, providerResponseError } from '../../services/providerResponseDiagnosis.mjs';

test('diagnostics redact arbitrary errors and reject hostile codes/accessors', () => {
  for (const error of [new Error('PRIVATE credentials'), { code: 'PROVIDER_RESPONSE_INVALID', providerResponseIssue: '__proto__' },
    { code: 'PROVIDER_RESPONSE_INVALID', providerResponseIssue: { toString: () => 'model' } },
    Object.defineProperty({}, 'code', { get() { throw new Error('PRIVATE'); } }), null]) {
    expect(diagnoseProviderResponse(error)).toMatchObject({ code: 'unknown', phase: 'refresh', slowRetry: false });
    expect(JSON.stringify(diagnoseProviderResponse(error))).not.toMatch(/PRIVATE|credentials"/);
  }
  expect(diagnoseProviderResponse(providerResponseError('json', 'inspection'))).toMatchObject({ code: 'json', phase: 'inspection' });
  expect(diagnoseProviderResponse(providerResponseError('PRIVATE', 'PRIVATE'))).toMatchObject({ code: 'unknown' });
  let accesses = 0;
  const changing = Object.defineProperty({ code: 'PROVIDER_RESPONSE_INVALID' }, 'providerResponseIssue', {
    get() { return accesses++ === 0 ? 'zero' : { PRIVATE: 'response' }; },
  });
  expect(diagnoseProviderResponse(changing)).toMatchObject({ code: 'zero' });
  expect(accesses).toBe(1);
});

test.each(['http_auth', 'http_missing', 'http_rejected', 'representation', 'body_limit'])('persistent %s failures get hourly rechecks', issue => {
  const recovery = createInventoryDescriptionRecovery({ now: () => 0, random: () => 1 });
  expect(recovery.failed(providerResponseError(issue))).toEqual({ failureCode: issue, retryAfterSeconds: 3600 });
  expect(recovery.isCoolingDown()).toBe(true);
});

test('jitter is bounded; one failed pass schedules one retry and successful completion resets it', () => {
  let time = 0;
  const recovery = createInventoryDescriptionRecovery({ now: () => time, random: () => 1 });
  for (const seconds of [75, 150, 300, 600, 1200, 2400, 3600, 3600]) {
    expect(recovery.failed(providerResponseError('http_busy'))).toMatchObject({ retryAfterSeconds: seconds });
    time += seconds * 1000 - 1;
    expect(recovery.isCoolingDown()).toBe(true);
    time++;
    expect(recovery.isCoolingDown()).toBe(false);
  }
  recovery.completed();
  expect(recovery.failed(providerResponseError('http_busy'))).toMatchObject({ retryAfterSeconds: 75 });
});

test.each([NaN, Infinity, -1, 2])('bounds injected jitter %s', random => {
  const recovery = createInventoryDescriptionRecovery({ now: () => 0, random: () => random });
  const { retryAfterSeconds } = recovery.failed(new Error());
  expect(retryAfterSeconds).toBeGreaterThanOrEqual(60);
  expect(retryAfterSeconds).toBeLessThanOrEqual(75);
});

test('thousands of failures are deduplicated and completion distinguishes actual committed progress', () => {
  let time = 0;
  const log = { warn: jest.fn(), info: jest.fn() };
  const recovery = createInventoryDescriptionRecovery({ log, now: () => time, random: () => 0 });
  for (let index = 0; index < 5000; index++) recovery.failed(providerResponseError('json'));
  expect(log.warn).toHaveBeenCalledTimes(1);
  time += 1_800_000;
  recovery.failed(providerResponseError('json'));
  expect(log.warn).toHaveBeenCalledTimes(2);
  expect(log.warn.mock.calls[1][1]).toMatchObject({ code: 'json', occurrences: 5001 });
  recovery.committed(8);
  for (const invalid of [NaN, 0, -1, 9, '1', 1.5]) recovery.committed(invalid);
  recovery.completed();
  expect(log.info).toHaveBeenCalledWith('Description backfill caught up', expect.objectContaining({ code: 'json', validatedDescriptionsCommitted: 8 }));
  recovery.completed();
  expect(log.info).toHaveBeenCalledTimes(1);
  recovery.failed(providerResponseError('json'));
  recovery.completed();
  expect(log.info.mock.calls[1][1]).toMatchObject({ validatedDescriptionsCommitted: 0,
    recovery: expect.stringContaining('No new provider response was validated') });
});

test('both synchronous and asynchronous logger failures cannot break recovery', async () => {
  for (const failure of [() => { throw new Error('PRIVATE'); }, async () => { throw new Error('PRIVATE'); }]) {
    const recovery = createInventoryDescriptionRecovery({ log: { warn: failure, info: failure } });
    expect(() => recovery.failed(providerResponseError('zero'))).not.toThrow();
    expect(() => recovery.completed()).not.toThrow();
    await Promise.resolve();
  }
});

test('isolation warnings do not pause unrelated work or expose content fingerprints', () => {
  const log = { warn: jest.fn(), info: jest.fn() };
  const recovery = createInventoryDescriptionRecovery({ log, now: () => 0, random: () => 0 });
  for (let index = 0; index < 5000; index++) recovery.isolated(providerResponseError('batch'), 8, 60000);
  expect(recovery.isCoolingDown()).toBe(false);
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.warn.mock.calls[0][1]).toMatchObject({ affectedDescriptions: 8, recovery: expect.stringContaining('does not identify the culprit') });
  for (const [count, delay] of [[0, 60000], [9, 60000], [1, 0], [1, 3600001]]) recovery.isolated(new Error('PRIVATE'), count, delay);
  expect(log.warn).toHaveBeenCalledTimes(1);
});
