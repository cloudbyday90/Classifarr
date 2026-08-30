/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildAdjacentCompletedUtcDayMetricsWindows,
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

  test('creates adjacent fixed completed UTC-day windows without overlap', () => {
    expect(buildAdjacentCompletedUtcDayMetricsWindows({
      windowDays: 7,
      now: new Date('2026-08-30T18:30:00.000Z'),
    })).toEqual({
      current: {
        days: 7,
        start: new Date('2026-08-23T00:00:00.000Z'),
        end: new Date('2026-08-30T00:00:00.000Z'),
      },
      previous: {
        days: 7,
        start: new Date('2026-08-16T00:00:00.000Z'),
        end: new Date('2026-08-23T00:00:00.000Z'),
      },
    });
  });
});
