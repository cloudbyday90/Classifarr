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
  POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE,
} from './policyCandidateCorrectionRepresentativeReviewCorpusCapturePersistence.mjs';

/**
 * Reads the only database shape allowed to cross into the future-capture
 * evaluator: counts grouped by its two fixed, content-free dimensions. The
 * query intentionally omits capture IDs, actor IDs, timestamps, evidence
 * JSON, media, library, policy, model, prompt, response, and RAG content.
 */
export async function listPolicyCandidateCorrectionRepresentativeReviewCorpusCaptureEvaluationAggregates({
  dbClient,
  configurationRevision,
  now,
} = {}) {
  const result = await dbClient.query(
    `SELECT
       score_margin_band_id,
       selection_status_id,
       COUNT(*)::integer AS capture_count
     FROM ${POLICY_CANDIDATE_CORRECTION_REPRESENTATIVE_REVIEW_CORPUS_CAPTURE_TABLE}
     WHERE configuration_revision = $1
       AND captured_at <= $2::timestamptz
       AND expires_at > $2::timestamptz
     GROUP BY score_margin_band_id, selection_status_id
     ORDER BY score_margin_band_id ASC, selection_status_id ASC`,
    [configurationRevision, now],
  );
  return Array.isArray(result?.rows) ? result.rows : [];
}
