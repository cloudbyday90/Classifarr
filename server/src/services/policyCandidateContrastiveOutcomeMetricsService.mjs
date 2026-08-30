/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildPolicyCandidateContrastiveOutcomeMetricsReport,
  buildPolicyCandidateContrastiveOutcomeMetricsWindow,
} from './policyCandidateContrastiveOutcomeMetrics.mjs';
import {
  loadPolicyCandidateContrastiveOutcomeMetrics,
} from './policyCandidateContrastiveOutcomeMetricsRepository.mjs';

export function createPolicyCandidateContrastiveOutcomeMetricsService({
  database = db,
  loadMetrics = loadPolicyCandidateContrastiveOutcomeMetrics,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const window = buildPolicyCandidateContrastiveOutcomeMetricsWindow({
        windowDays,
        now: now(),
      });
      const rows = await loadMetrics(database, window);
      return buildPolicyCandidateContrastiveOutcomeMetricsReport({ rows, window });
    },
  });
}
