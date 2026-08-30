/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildPolicyCandidateCorrectionAnalyticsMetricsWindows,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  buildPolicyCandidateCorrectionTemporalStabilityReport,
} from './policyCandidateCorrectionTemporalStabilityReport.mjs';
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
      const windows = buildPolicyCandidateCorrectionAnalyticsMetricsWindows({
        windowDays,
        now: now(),
      });
      const [currentRows, previousRows] = await Promise.all([
        loadMetrics(database, windows.current),
        loadMetrics(database, windows.previous),
      ]);
      return buildPolicyCandidateCorrectionTemporalStabilityReport({
        currentRows,
        previousRows,
        currentWindow: windows.current,
        previousWindow: windows.previous,
      });
    },
  });
}
