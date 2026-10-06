/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createComparisonRefreshRetry } from '../../services/comparisonRefreshRetry.mjs';

function fixture(random = () => 0) {
  let time = 1_000_000;
  return { retry: createComparisonRefreshRetry({ now: () => time, random }), advance: ms => { time += ms; } };
}

test.each([0, 0.5, 1, -1, 2, NaN, Infinity, undefined])('genuine failure backoff retains sequence, cap and jitter %s', value => {
  const v = fixture(() => value), jitter = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  expect(v.retry.isCoolingDown()).toBe(false);
  for (const base of [60000, 120000, 240000, 480000, 960000, 1800000, 1800000, 1800000]) {
    v.retry.fail();
    v.advance(base * (1 + jitter * 0.25) - 1); expect(v.retry.isCoolingDown()).toBe(true);
    v.advance(1); expect(v.retry.isCoolingDown()).toBe(false);
  }
});

test('resource deferral neither shortens outstanding failure delay nor increases/resets its counter', () => {
  const v = fixture(() => 1);
  for (let index = 0; index < 3; index++) { v.retry.fail(); v.advance(75000 * 2 ** index); }
  v.retry.fail(); // Fourth failure: 600 seconds including jitter.
  v.advance(60000); v.retry.defer(); v.advance(60000);
  expect(v.retry.isCoolingDown()).toBe(true);
  v.advance(480000); expect(v.retry.isCoolingDown()).toBe(false);
  for (let index = 0; index < 10; index++) {
    v.retry.defer(); v.advance(59999); expect(v.retry.isCoolingDown()).toBe(true);
    v.advance(1); expect(v.retry.isCoolingDown()).toBe(false);
  }
  v.retry.fail(); v.advance(1199999); expect(v.retry.isCoolingDown()).toBe(true);
  v.advance(1); expect(v.retry.isCoolingDown()).toBe(false);
});

test('deadline invalidation retains history; reset and new process start with the original first delay', () => {
  const v = fixture();
  v.retry.fail(); v.retry.defer(); v.retry.clearDeadlines();
  expect(v.retry.isCoolingDown()).toBe(false);
  v.retry.fail(); v.advance(119999); expect(v.retry.isCoolingDown()).toBe(true);
  v.advance(1); expect(v.retry.isCoolingDown()).toBe(false);
  v.retry.defer(); v.retry.reset(); expect(v.retry.isCoolingDown()).toBe(false);
  v.retry.fail(); v.advance(60000); expect(v.retry.isCoolingDown()).toBe(false);
  expect(fixture().retry.isCoolingDown()).toBe(false);
});
