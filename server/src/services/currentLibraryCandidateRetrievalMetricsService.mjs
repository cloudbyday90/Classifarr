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
import {
  loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics,
} from './currentLibraryCandidateSemanticAdjudicationWorkbenchMetricsRepository.mjs';

export function createCurrentLibraryCandidateRetrievalMetricsService({
  database = db,
  loadMetrics = loadCurrentLibraryCandidateRetrievalMetrics,
  loadSemanticAdjudicationWorkbenchMetrics =
    loadCurrentLibraryCandidateSemanticAdjudicationWorkbenchMetrics,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getSummary({ windowDays } = {}) {
      const window = buildCurrentLibraryCandidateRetrievalMetricsWindow({
        windowDays,
        now: now(),
      });
      const [row, semanticAdjudicationWorkbenchRow] = await Promise.all([
        loadMetrics(database, window),
        loadSemanticAdjudicationWorkbenchMetrics(database, window),
      ]);
      return buildCurrentLibraryCandidateRetrievalMetricsReport({
        row,
        semanticAdjudicationWorkbenchRow,
        window,
      });
    },
  });
}
