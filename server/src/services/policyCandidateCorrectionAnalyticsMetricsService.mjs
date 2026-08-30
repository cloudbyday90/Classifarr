/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildPolicyCandidateCorrectionAnalyticsMetricsReport,
  buildPolicyCandidateCorrectionAnalyticsMetricsWindow,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  loadPolicyCandidateCorrectionAnalyticsMetrics,
} from './policyCandidateCorrectionAnalyticsMetricsRepository.mjs';

export function createPolicyCandidateCorrectionAnalyticsMetricsService({
  database = db,
  loadMetrics = loadPolicyCandidateCorrectionAnalyticsMetrics,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const window = buildPolicyCandidateCorrectionAnalyticsMetricsWindow({
        windowDays,
        now: now(),
      });
      const rows = await loadMetrics(database, window);
      return buildPolicyCandidateCorrectionAnalyticsMetricsReport({ rows, window });
    },
  });
}
