/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS = 7;
export const COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS = 30;

function startOfUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

export function normalizeCompletedUtcDayMetricsWindowDays(value) {
  return Math.min(
    positiveInteger(value) || COMPLETED_UTC_DAY_METRICS_DEFAULT_WINDOW_DAYS,
    COMPLETED_UTC_DAY_METRICS_MAX_WINDOW_DAYS,
  );
}

/**
 * Excludes the in-progress UTC day so aggregate monitoring remains comparable
 * across refreshes. Callers can reuse this bounded, content-free time window
 * without depending on an unrelated monitoring domain.
 */
export function buildCompletedUtcDayMetricsWindow({
  windowDays,
  now = new Date(),
} = {}) {
  const days = normalizeCompletedUtcDayMetricsWindowDays(windowDays);
  const end = startOfUtcDay(now);
  if (!end) throw new TypeError('A valid observation time is required.');

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return Object.freeze({ days, start, end });
}
