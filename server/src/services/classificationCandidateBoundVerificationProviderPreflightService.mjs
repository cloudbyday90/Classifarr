/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildCandidateBoundVerificationProviderPreflight,
} from './classificationCandidateBoundVerificationProviderPreflight.mjs';
import {
  loadCandidateBoundVerificationProviderPreflightConfiguration,
} from './classificationCandidateBoundVerificationProviderPreflightRepository.mjs';

/** @typedef {Record<string, unknown>} CandidateBoundVerificationProviderPreflightConfiguration */

/**
 * @typedef {{
 *   query: (sql: string, params?: unknown[]) => Promise<{ rows?: CandidateBoundVerificationProviderPreflightConfiguration[] }>,
 * }} CandidateBoundVerificationProviderPreflightDatabase
 */

/**
 * @param {{
 *   database?: CandidateBoundVerificationProviderPreflightDatabase,
 *   loadConfiguration?: (database: CandidateBoundVerificationProviderPreflightDatabase) => Promise<CandidateBoundVerificationProviderPreflightConfiguration | null>,
 *   buildPreflight?: (options: {
 *     proposedConfiguration?: CandidateBoundVerificationProviderPreflightConfiguration | null,
 *     existingConfiguration?: CandidateBoundVerificationProviderPreflightConfiguration | null,
 *     presentationContext?: string,
 *   }) => Record<string, unknown>,
 * }} options
 */
export function createCandidateBoundVerificationProviderPreflightService(options = {}) {
  const {
    database = db,
    loadConfiguration = loadCandidateBoundVerificationProviderPreflightConfiguration,
    buildPreflight = buildCandidateBoundVerificationProviderPreflight,
  } = options;

  return Object.freeze({
    /** @param {{ proposedConfiguration?: CandidateBoundVerificationProviderPreflightConfiguration, presentationContext?: string }} request */
    async getPreflight({ proposedConfiguration, presentationContext } = {}) {
      const existingConfiguration = await loadConfiguration(database);
      const options = {
        proposedConfiguration,
        existingConfiguration,
      };
      if (presentationContext) {
        options.presentationContext = presentationContext;
      }
      return buildPreflight(options);
    },
  });
}
