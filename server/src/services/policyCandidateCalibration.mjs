/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { CANDIDATE_VIABILITY } from './policyCandidateDiagnostics.mjs';

const CALIBRATION_RULES = Object.freeze({
  negative_conflict: {
    multiplier: 0,
    cap: 0,
    reason: 'negative_conflict',
  },
  [CANDIDATE_VIABILITY.COMPATIBILITY_ONLY]: {
    multiplier: 0.60,
    cap: 55,
    reason: 'compatibility_only',
  },
  [CANDIDATE_VIABILITY.PROFILE_ONLY]: {
    multiplier: 0.65,
    cap: 60,
    reason: 'profile_only',
  },
  [CANDIDATE_VIABILITY.RAG_IMPROVED]: {
    multiplier: 0.70,
    cap: 60,
    reason: 'rag_only',
  },
  [CANDIDATE_VIABILITY.NO_POSITIVE_EVIDENCE]: {
    multiplier: 0,
    cap: 0,
    reason: 'no_positive_evidence',
  },
});

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function normalizeScore(score) {
  const numeric = Number(score);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function getCalibrationRule(candidate = {}) {
  const diagnostics = candidate?.candidate_diagnostics || {};
  if (diagnostics.evidence_class === 'negative_conflict') {
    return CALIBRATION_RULES.negative_conflict;
  }

  return CALIBRATION_RULES[diagnostics.primary_viability] || null;
}

export function calibratePolicyCandidate(candidate = {}) {
  const rawScore = normalizeScore(candidate.score);
  const rule = getCalibrationRule(candidate);
  const calibratedScore = rule
    ? Math.min(rawScore * rule.multiplier, rule.cap)
    : rawScore;

  const score = roundScore(calibratedScore);
  const calibration = {
    schema_version: 1,
    applied: Boolean(rule),
    raw_score: roundScore(rawScore),
    calibrated_score: score,
    multiplier: rule?.multiplier ?? 1,
    cap: rule?.cap ?? null,
    reason_code: rule?.reason ?? 'strong_evidence',
  };

  return {
    ...candidate,
    raw_score: roundScore(rawScore),
    score,
    candidate_diagnostics: {
      ...(candidate.candidate_diagnostics || {}),
      score_calibration: calibration,
    },
  };
}
