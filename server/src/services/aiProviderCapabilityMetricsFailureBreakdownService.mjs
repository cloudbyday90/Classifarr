/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildAiProviderCapabilityMetricsFailureBreakdownReport,
} from './aiProviderCapabilityMetricsFailureBreakdown.mjs';
import {
  loadAiProviderCapabilityMetricsFailureBreakdown,
} from './aiProviderCapabilityMetricsFailureBreakdownRepository.mjs';
import {
  buildAiProviderCapabilityMetricsHealthWindow,
} from './aiProviderCapabilityMetricsHealth.mjs';

/**
 * Owns the read-only, fixed-window diagnostic projection. It cannot call an
 * AI provider, retry a metric write, mutate logging, or affect any routing
 * authority.
 */
export function createAiProviderCapabilityMetricsFailureBreakdownService({
  database = db,
  loadBreakdown = loadAiProviderCapabilityMetricsFailureBreakdown,
  buildWindow = buildAiProviderCapabilityMetricsHealthWindow,
  buildReport = buildAiProviderCapabilityMetricsFailureBreakdownReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildWindow({ now: now() });
      const row = await loadBreakdown(database, window);
      return buildReport({ row, window });
    },
  });
}
