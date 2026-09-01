/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildAiProviderCapabilityMetricsHealthReport,
  buildAiProviderCapabilityMetricsHealthWindow,
} from './aiProviderCapabilityMetricsHealth.mjs';
import {
  loadAiProviderCapabilityMetricsHealth,
} from './aiProviderCapabilityMetricsHealthRepository.mjs';

/**
 * Owns a read-only health projection. It cannot call a provider, write a
 * metric, or influence provider admission, policy, RAG, classification, or
 * routing.
 */
export function createAiProviderCapabilityMetricsHealthService({
  database = db,
  loadHealth = loadAiProviderCapabilityMetricsHealth,
  buildWindow = buildAiProviderCapabilityMetricsHealthWindow,
  buildReport = buildAiProviderCapabilityMetricsHealthReport,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildWindow({ now: now() });
      const row = await loadHealth(database, window);
      return buildReport({ row, window });
    },
  });
}
