/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildOllamaVerificationCapabilityOutcomeHistory,
} from './ollamaVerificationCapabilityOutcomeHistory.mjs';
import {
  loadOllamaVerificationCapabilityOutcomeHistory,
} from './ollamaVerificationCapabilityOutcomeHistoryRepository.mjs';

/**
 * The query is parameter-free and bounded by retention at both read and
 * write time. Keeping this read service separate makes the public projection
 * independently testable from test execution and persistence.
 */
export function createOllamaVerificationCapabilityOutcomeHistoryService({
  database = db,
  loadHistory = loadOllamaVerificationCapabilityOutcomeHistory,
  buildHistory = buildOllamaVerificationCapabilityOutcomeHistory,
} = {}) {
  return Object.freeze({
    async getHistory() {
      return buildHistory(await loadHistory(database));
    },
  });
}
