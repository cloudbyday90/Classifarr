/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildCurrentLibraryCandidateRetrievalMetricsReport,
  buildCurrentLibraryCandidateRetrievalMetricsWindow,
} from './currentLibraryCandidateRetrievalTelemetryMetrics.mjs';
import {
  loadCurrentLibraryCandidateRetrievalMetrics,
} from './currentLibraryCandidateRetrievalMetricsRepository.mjs';

export function createCurrentLibraryCandidateRetrievalMetricsService({
  database = db,
  loadMetrics = loadCurrentLibraryCandidateRetrievalMetrics,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const window = buildCurrentLibraryCandidateRetrievalMetricsWindow({
        windowDays,
        now: now(),
      });
      const row = await loadMetrics(database, window);
      return buildCurrentLibraryCandidateRetrievalMetricsReport({ row, window });
    },
  });
}
