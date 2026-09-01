/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { calibratePolicyCandidate } from './policyCandidateCalibration.mjs';

/**
 * Orders already-calibrated candidates without relying on mutable names.
 *
 * The ordering is intentionally shared by live ranking and fixed synthetic
 * evaluation so an offline evaluation cannot silently diverge from the
 * production score-calibration path.
 */
export function compareRankedPolicyCandidates(left, right) {
  const scoreDelta = right.score - left.score;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const libraryDelta = Number(left.library_id || 0) - Number(right.library_id || 0);
  if (libraryDelta !== 0) {
    return libraryDelta;
  }

  const policyDelta = Number(left.policy_id || 0) - Number(right.policy_id || 0);
  if (policyDelta !== 0) {
    return policyDelta;
  }

  return 0;
}

/**
 * Produces only a deterministic score-calibration and ordering projection.
 * It has no logging, threshold-warning, persistence, AI/RAG, policy, or
 * routing side effects.
 */
export function projectRankedPolicyCandidates(evaluations = []) {
  if (!Array.isArray(evaluations)) {
    return [];
  }

  return evaluations
    .filter((evaluation) => Number.isFinite(evaluation?.score) && evaluation.score > 0)
    .map(calibratePolicyCandidate)
    .filter((evaluation) => Number.isFinite(evaluation?.score) && evaluation.score > 0)
    .sort(compareRankedPolicyCandidates);
}
