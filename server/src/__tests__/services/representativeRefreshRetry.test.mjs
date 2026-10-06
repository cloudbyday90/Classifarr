/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { createRepresentativeRefreshRetry } from '../../services/representativeRefreshRetry.mjs';

test('deferrals do not erase or grow failure history, and exact eligibility is inclusive', () => {
  let time = 0;
  const retry = createRepresentativeRefreshRetry({ now: () => time });
  expect(retry.isCoolingDown()).toBe(false);
  retry.fail(); time = 60_000; retry.fail();
  time = 90_000; retry.defer();
  time = 150_000; expect(retry.isCoolingDown()).toBe(true);
  time = 179_999; expect(retry.isCoolingDown()).toBe(true);
  time = 180_000; expect(retry.isCoolingDown()).toBe(false);
  retry.fail(); time = 419_999; expect(retry.isCoolingDown()).toBe(true);
  time = 420_000; expect(retry.isCoolingDown()).toBe(false);
  retry.reset(); retry.defer();
  time = 480_000; expect(retry.isCoolingDown()).toBe(false);
  retry.fail(); time = 540_000; expect(retry.isCoolingDown()).toBe(false);
});

test('genuine failure backoff remains bounded at one hour, including after late ticks', () => {
  let time = 0;
  const retry = createRepresentativeRefreshRetry({ now: () => time });
  for (const wait of [60_000, 120_000, 240_000, 480_000, 960_000, 1_920_000, 3_600_000, 3_600_000]) {
    retry.fail(); time += wait - 1; expect(retry.isCoolingDown()).toBe(true);
    time++; expect(retry.isCoolingDown()).toBe(false);
  }
  time += 10_000_000; expect(retry.isCoolingDown()).toBe(false);
  retry.reset(); retry.fail(); time += 60_000; expect(retry.isCoolingDown()).toBe(false);
});

test('a new process policy starts without persisted retry state', () => {
  const first = createRepresentativeRefreshRetry({ now: () => 0 });
  first.fail(); first.defer(); expect(first.isCoolingDown()).toBe(true);
  expect(createRepresentativeRefreshRetry({ now: () => 0 }).isCoolingDown()).toBe(false);
});
