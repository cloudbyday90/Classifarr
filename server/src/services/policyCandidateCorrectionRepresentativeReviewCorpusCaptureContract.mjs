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
  buildPolicyCandidateCorrectionOutcomeAttributionProjection,
} from './policyCandidateCorrectionOutcomeAttribution.mjs';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_VERSION =
  'policy.candidate_correction_representative_review_corpus_capture.v1';

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_STATUS_IDS = Object.freeze({
  CAPTURED: 'captured',
  CONTROL_NOT_ACKNOWLEDGED: 'control_not_acknowledged',
  NOT_ELIGIBLE: 'not_eligible',
});

export const POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_AUDIT_ACTION_IDS =
  Object.freeze({
    CAPTURE_RECORDED: 'capture_recorded',
    CAPTURE_EXPIRED: 'capture_expired',
  });

/**
 * Rebuilds the only evaluation payload permitted at the capture boundary.
 * This intentionally rejects a caller-provided title, media identifier,
 * library, policy, prompt, response, provider, or RAG field.
 */
export function normalizePolicyCandidateCorrectionRepresentativeReviewCorpusCaptureAttribution(value) {
  return buildPolicyCandidateCorrectionOutcomeAttributionProjection(value);
}
