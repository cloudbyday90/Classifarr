/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_PURPOSE_ID =
  'representative_historical_correction_review';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_FRAME = Object.freeze({
  periodCount: 2,
  completedUtcDaysPerPeriod: 28,
  strata: Object.freeze([
    'score_margin_band',
    'operator_selection_outcome',
  ]),
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_REQUIRED_SAFEGUARD_IDS =
  Object.freeze([
    'authorization',
    'redaction',
    'retention',
    'operator_audit',
  ]);
