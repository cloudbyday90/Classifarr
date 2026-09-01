/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision,
  normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration,
} from './policyCandidateCorrectionRepresentativeReviewCorpusControlContract.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_DEFAULT_AUTOMATIC_CAPTURE_RETENTION_DAYS = 30;

/**
 * Selects the safe, content-free configuration for normal future capture.
 *
 * A historical-snapshot acknowledgement may optionally replace the default
 * retention period, but is never required to start future capture. The
 * revision deliberately matches the established capture storage contract so
 * a default configuration remains comparable across deployments.
 */
export function getPolicyCandidateCorrectionRepresentativeReviewCorpusAutomaticCaptureConfiguration(
  controlRow = null,
) {
  const acknowledgedConfiguration = controlRow
    ? normalizePolicyCandidateCorrectionRepresentativeReviewCorpusControlConfiguration(controlRow)
    : null;
  if (acknowledgedConfiguration) {
    return Object.freeze({
      revision: acknowledgedConfiguration.revision,
      reviewRecordRetentionDays: acknowledgedConfiguration.reviewRecordRetentionDays,
      sourceId: 'acknowledged_retention_choice',
    });
  }

  const reviewRecordRetentionDays =
    POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_DEFAULT_AUTOMATIC_CAPTURE_RETENTION_DAYS;
  return Object.freeze({
    revision: buildPolicyCandidateCorrectionRepresentativeReviewCorpusControlRevision({
      reviewRecordRetentionDays,
    }),
    reviewRecordRetentionDays,
    sourceId: 'safe_default',
  });
}
