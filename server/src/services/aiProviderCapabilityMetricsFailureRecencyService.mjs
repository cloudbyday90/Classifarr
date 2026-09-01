/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildAiProviderCapabilityMetricsFailureRecencyReport,
} from './aiProviderCapabilityMetricsFailureRecency.mjs';
import {
  loadAiProviderCapabilityMetricsFailureRecency,
} from './aiProviderCapabilityMetricsFailureRecencyRepository.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';

/**
 * Owns the read-only retained-warning recency report. It cannot call an AI
 * provider, mutate telemetry, alter a policy, or affect RAG, classification,
 * and routing authority.
 */
export function createAiProviderCapabilityMetricsFailureRecencyService({
  database = db,
  loadRecency = loadAiProviderCapabilityMetricsFailureRecency,
  buildWindow = buildAiProviderCapabilityMetricsHealthTrendWindow,
  buildReport = buildAiProviderCapabilityMetricsFailureRecencyReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildWindow({ now: now() });
      const rows = await loadRecency(database, window);
      return buildReport({ rows, window });
    },
  });
}
