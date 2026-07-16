/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const NATIVE_INTENT_RECONCILIATION_TASK_NAME = 'native-intent-reconciliation';
export const NATIVE_INTENT_RECONCILIATION_CRON = '*/10 * * * *';
export const NATIVE_INTENT_RECONCILIATION_INITIAL_DELAY_MS = 90_000;
export const NATIVE_INTENT_RECONCILIATION_SCHEDULE_INTERVAL_MS = 10 * 60 * 1000;

function normalizeTimestamp(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

/**
 * Returns the next ten-minute scheduler boundary. This is intentionally a
 * scheduling expectation, not a promise that the automatic run will execute:
 * the operational control may defer it before discovery starts.
 */
export function getNextNativeIntentReconciliationAttemptAt(now = new Date()) {
  const evaluatedAt = normalizeTimestamp(now).getTime();
  const nextBoundary = Math.floor(evaluatedAt / NATIVE_INTENT_RECONCILIATION_SCHEDULE_INTERVAL_MS + 1)
    * NATIVE_INTENT_RECONCILIATION_SCHEDULE_INTERVAL_MS;
  return new Date(nextBoundary).toISOString();
}
