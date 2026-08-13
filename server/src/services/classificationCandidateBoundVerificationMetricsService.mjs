/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_METRICS_VERSION,
  buildCandidateBoundVerificationMetricsWindow,
} from './classificationCandidateBoundVerificationMetrics.mjs';
import {
  buildCandidateBoundVerificationDriftReport,
} from './classificationCandidateBoundVerificationDriftGuard.mjs';
import {
  loadCandidateBoundVerificationDailyOutcomeMetrics,
} from './classificationCandidateBoundVerificationMetricsRepository.mjs';

export function createCandidateBoundVerificationMetricsService({
  database = db,
  loadDailyOutcomeMetrics = loadCandidateBoundVerificationDailyOutcomeMetrics,
  buildDriftReport = buildCandidateBoundVerificationDriftReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const window = buildCandidateBoundVerificationMetricsWindow({ windowDays, now: now() });
      const rows = await loadDailyOutcomeMetrics(database, window);
      const report = buildDriftReport({
        rows,
        previousStart: window.previousStart,
        currentStart: window.currentStart,
        currentEnd: window.currentEnd,
        windowDays: window.days,
      });

      return Object.freeze({
        ...report,
        version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_METRICS_VERSION,
      });
    },
  });
}
