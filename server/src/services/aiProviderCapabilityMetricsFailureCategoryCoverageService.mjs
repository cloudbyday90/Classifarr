/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildAiProviderCapabilityMetricsFailureCategoryCoverageReport,
} from './aiProviderCapabilityMetricsFailureCategoryCoverage.mjs';
import {
  loadAiProviderCapabilityMetricsFailureCategoryCoverage,
} from './aiProviderCapabilityMetricsFailureCategoryCoverageRepository.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';

/**
 * Owns the read-only category-contract adoption report. It cannot call an AI
 * provider, mutate telemetry, alter a policy, or affect RAG, classification,
 * or routing authority.
 */
export function createAiProviderCapabilityMetricsFailureCategoryCoverageService({
  database = db,
  loadCoverage = loadAiProviderCapabilityMetricsFailureCategoryCoverage,
  buildWindow = buildAiProviderCapabilityMetricsHealthTrendWindow,
  buildReport = buildAiProviderCapabilityMetricsFailureCategoryCoverageReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildWindow({ now: now() });
      const rows = await loadCoverage(database, window);
      return buildReport({ rows, window });
    },
  });
}
