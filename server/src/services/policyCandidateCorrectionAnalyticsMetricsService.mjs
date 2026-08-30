/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildPolicyCandidateCorrectionAnalyticsMetricsWindows,
} from './policyCandidateCorrectionAnalyticsMetrics.mjs';
import {
  buildAdjacentCompletedUtcDayMetricsWindows,
} from './completedUtcDayMetricsWindow.mjs';
import {
  POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_WINDOW_DAYS,
} from './policyCandidateCorrectionLongHorizonTrend.mjs';
import {
  buildPolicyCandidateCorrectionLongHorizonTrendReport,
} from './policyCandidateCorrectionLongHorizonTrendReport.mjs';
import {
  buildPolicyCandidateCorrectionTemporalStabilityReport,
} from './policyCandidateCorrectionTemporalStabilityReport.mjs';
import {
  loadPolicyCandidateCorrectionAnalyticsMetrics,
} from './policyCandidateCorrectionAnalyticsMetricsRepository.mjs';

function windowKey({ start, end } = {}) {
  return start instanceof Date && end instanceof Date
    ? `${start.toISOString()}:${end.toISOString()}`
    : null;
}

function createWindowMetricsLoader({ database, loadMetrics }) {
  const pendingLoads = new Map();

  return (window) => {
    const key = windowKey(window);
    if (!key) throw new TypeError('A valid aggregate observation window is required.');
    if (!pendingLoads.has(key)) {
      pendingLoads.set(key, loadMetrics(database, window));
    }
    return pendingLoads.get(key);
  };
}

export function createPolicyCandidateCorrectionAnalyticsMetricsService({
  database = db,
  loadMetrics = loadPolicyCandidateCorrectionAnalyticsMetrics,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const observationNow = now();
      const windows = buildPolicyCandidateCorrectionAnalyticsMetricsWindows({
        windowDays,
        now: observationNow,
      });
      const longHorizonWindows = buildAdjacentCompletedUtcDayMetricsWindows({
        windowDays: POLICY_CANDIDATE_CORRECTION_LONG_HORIZON_WINDOW_DAYS,
        now: observationNow,
      });
      const loadWindowMetrics = createWindowMetricsLoader({ database, loadMetrics });
      const [currentRows, previousRows, longHorizonCurrentRows, longHorizonPreviousRows] = await Promise.all([
        loadWindowMetrics(windows.current),
        loadWindowMetrics(windows.previous),
        loadWindowMetrics(longHorizonWindows.current),
        loadWindowMetrics(longHorizonWindows.previous),
      ]);
      return buildPolicyCandidateCorrectionTemporalStabilityReport({
        currentRows,
        previousRows,
        currentWindow: windows.current,
        previousWindow: windows.previous,
        longHorizonTrend: buildPolicyCandidateCorrectionLongHorizonTrendReport({
          currentRows: longHorizonCurrentRows,
          previousRows: longHorizonPreviousRows,
          currentWindow: longHorizonWindows.current,
          previousWindow: longHorizonWindows.previous,
        }),
      });
    },
  });
}
