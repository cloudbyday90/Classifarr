/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_TASK_NAME =
  'held-out-semantic-study-lifecycle-reaudit';
// The re-audit performs only fixed aggregate source reads unless a fingerprint
// changes. Keep its normal passive detection cadence aligned with the visible
// readiness status without coupling it to authoring writes.
export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_CRON = '*/5 * * * *';
export const HELD_OUT_SEMANTIC_STUDY_LIFECYCLE_REAUDIT_INITIAL_DELAY_MS = 90 * 1000;
