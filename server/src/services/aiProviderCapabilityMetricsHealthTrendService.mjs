/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildAiProviderCapabilityMetricsHealthTrendReport,
  buildAiProviderCapabilityMetricsHealthTrendWindow,
} from './aiProviderCapabilityMetricsHealthTrend.mjs';
import {
  loadAiProviderCapabilityMetricsHealthTrend,
} from './aiProviderCapabilityMetricsHealthTrendRepository.mjs';

/**
 * Owns a read-only completed-window trend. It cannot call a provider, write a
 * metric, or influence provider admission, policy, RAG, classification, or
 * routing.
 */
export function createAiProviderCapabilityMetricsHealthTrendService({
  database = db,
  loadTrend = loadAiProviderCapabilityMetricsHealthTrend,
  buildWindow = buildAiProviderCapabilityMetricsHealthTrendWindow,
  buildReport = buildAiProviderCapabilityMetricsHealthTrendReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildWindow({ now: now() });
      const rows = await loadTrend(database, window);
      return buildReport({ rows, window });
    },
  });
}
