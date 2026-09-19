/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { descriptionIsolationCode, descriptionIsolationDelay, markDescriptionInputFailure, planDescriptionBackfill } from '../../services/inventoryDescriptionIsolation.mjs';
import { providerResponseError } from '../../services/providerResponseDiagnosis.mjs';

test('fresh batches and oldest due retries share eight calls without starving either category', () => {
  const pending = Array.from({ length: 100 }, (_, index) => String(index));
  const journal = new Map([['oldest', { due: true }], ['second', { due: true }], ['waiting', { due: false }]]);
  const plan = planDescriptionBackfill([...pending, ...journal.keys()], journal);
  expect(plan).toHaveLength(8);
  expect(plan[1]).toEqual(['oldest']);
  expect(plan[5]).toEqual(['second']);
  expect(plan.flat()).toHaveLength(50);
  expect(plan.flat()).not.toContain('waiting');
  expect(new Set(plan.flat()).size).toBe(50);
});

test('unused fresh slots serve due retries; no due work produces an empty plan', () => {
  const journal = new Map(Array.from({ length: 12 }, (_, index) => [String(index), { due: true }]));
  expect(planDescriptionBackfill([...journal.keys()], journal)).toEqual([...journal.keys()].slice(0, 8).map(hash => [hash]));
  expect(planDescriptionBackfill(['waiting'], new Map([['waiting', { due: false }]]))).toEqual([]);
  expect(planDescriptionBackfill(['one'], new Map())).toEqual([['one']]);
});

test('neighborhood priorities share fresh capacity without bypassing isolated retries', () => {
  const ordinary = Array.from({ length: 100 }, (_, index) => `ordinary-${index}`);
  const preferred = Array.from({ length: 100 }, (_, index) => `preferred-${index}`);
  const journal = new Map([['oldest', { due: true }], ['second', { due: true }], ['waiting', { due: false }]]);
  const pending = [...ordinary, ...preferred, ...journal.keys()];
  const plan = planDescriptionBackfill(pending, journal, ['waiting', 'absent', ...preferred, preferred[0], 'second']);
  expect(plan).toHaveLength(8);
  expect(plan[0]).toEqual([...preferred.slice(0, 4), ...ordinary.slice(0, 4)]);
  expect(plan[1]).toEqual(['oldest']); expect(plan[5]).toEqual(['second']);
  expect(plan.flat().filter(hash => hash.startsWith('ordinary-'))).toHaveLength(24);
  expect(plan.flat().filter(hash => hash.startsWith('preferred-'))).toHaveLength(24);
  expect(new Set(plan.flat()).size).toBe(50);
  expect(plan.flat()).not.toContain('waiting'); expect(plan.flat()).not.toContain('absent');
  expect(planDescriptionBackfill(preferred, new Map(), preferred).flat()).toEqual(preferred.slice(0, 64));
});

test.each(['transport', 'timeout', 'json', 'encoding', 'body_limit', 'http_auth', 'http_missing', 'http_busy', 'model'])('%s never identifies a bad individual description', code => {
  const error = providerResponseError(code, 'embedding');
  expect(markDescriptionInputFailure(error)).toBe(error);
  expect(descriptionIsolationCode(error)).toBeNull();
});

test('inspection rejection and unknown getters cannot become individual failures', () => {
  const inspection = providerResponseError('http_rejected', 'inspection');
  expect(markDescriptionInputFailure(inspection)).toBe(inspection);
  expect(descriptionIsolationCode({ descriptionInputIssue: 'PRIVATE' })).toBeNull();
  expect(descriptionIsolationCode(Object.defineProperty({}, 'descriptionInputIssue', { get() { throw new Error('PRIVATE'); } }))).toBeNull();
});

test.each(['http_rejected', 'batch', 'shape', 'dimensions', 'nonfinite', 'float32', 'zero'])('marks embedding-stage %s without retaining its original payload', code => {
  const error = Object.assign(providerResponseError(code, 'embedding'), { response: 'PRIVATE response', cause: new Error('PRIVATE') });
  const marked = markDescriptionInputFailure(error);
  expect(descriptionIsolationCode(marked)).toBe(code);
  expect(JSON.stringify(marked)).not.toContain('PRIVATE');
});

test('individual delays grow with capped attempts and reject malformed state', () => {
  expect(Array.from({ length: 8 }, (_, count) => descriptionIsolationDelay(count, () => 0))).toEqual([60000, 60000, 120000, 240000, 480000, 960000, 1920000, 3600000]);
  expect(descriptionIsolationDelay(1, () => 1)).toBe(75000);
  expect(descriptionIsolationDelay(1, () => NaN)).toBe(60000);
  for (const value of [-1, 8, NaN, '1', 0.5]) expect(() => descriptionIsolationDelay(value)).toThrow('description_isolation_attempts_invalid');
});
