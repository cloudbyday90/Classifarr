/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_PROFILE_REFRESH_OUTBOX_TASK_NAME = 'policy-profile-refresh-outbox';
export const POLICY_PROFILE_REFRESH_OUTBOX_CRON = '* * * * *';
export const POLICY_PROFILE_REFRESH_OUTBOX_INITIAL_DELAY_MS = 90_000;
export const POLICY_PROFILE_REFRESH_OUTBOX_SCHEDULE_INTERVAL_MS = 60 * 1000;

function normalizeTimestamp(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

export function getNextPolicyProfileRefreshOutboxAttemptAt(now = new Date()) {
  const evaluatedAt = normalizeTimestamp(now).getTime();
  const nextBoundary = Math.floor(
    evaluatedAt / POLICY_PROFILE_REFRESH_OUTBOX_SCHEDULE_INTERVAL_MS + 1,
  ) * POLICY_PROFILE_REFRESH_OUTBOX_SCHEDULE_INTERVAL_MS;
  return new Date(nextBoundary).toISOString();
}
