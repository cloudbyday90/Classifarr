/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildCompletedUtcDayMetricsWindow,
  normalizeCompletedUtcDayMetricsWindowDays,
} from '../../services/completedUtcDayMetricsWindow.mjs';

describe('completedUtcDayMetricsWindow', () => {
  test('uses a bounded completed UTC-day window independent of metric domain', () => {
    expect(normalizeCompletedUtcDayMetricsWindowDays(0)).toBe(7);
    expect(normalizeCompletedUtcDayMetricsWindowDays(100)).toBe(30);

    expect(buildCompletedUtcDayMetricsWindow({
      windowDays: 14,
      now: new Date('2026-08-30T18:30:00.000Z'),
    })).toEqual({
      days: 14,
      start: new Date('2026-08-16T00:00:00.000Z'),
      end: new Date('2026-08-30T00:00:00.000Z'),
    });
  });
});
