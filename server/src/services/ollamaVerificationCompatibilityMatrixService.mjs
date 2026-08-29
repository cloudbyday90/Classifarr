/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildOllamaVerificationCompatibilityMatrixReport,
  OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS,
  selectOllamaVerificationCompatibilityMatrixModels,
} from './ollamaVerificationCompatibilityMatrix.mjs';
import {
  probeOllamaVerificationCompatibilityMatrixModel,
} from './ollamaVerificationCompatibilityMatrixProbe.mjs';
import {
  resolveOllamaVerificationCapabilityIdentity,
} from './ollamaVerificationCapabilityIdentity.mjs';
import {
  loadOllamaVerificationCapabilityConfiguration,
} from './ollamaVerificationCapabilityRepository.mjs';
import {
  createOllamaVerificationSavedConfigurationClient,
} from './ollamaVerificationSavedConfigurationClient.mjs';

export class OllamaVerificationCompatibilityMatrixInProgressError extends Error {
  constructor() {
    super('An Ollama compatibility matrix is already running. Wait for it to finish before trying again.');
    this.name = 'OllamaVerificationCompatibilityMatrixInProgressError';
    this.code = 'ollama_verification_compatibility_matrix_in_progress';
  }
}

async function loadSafeOllamaVersion(getVersion) {
  try {
    return await getVersion();
  } catch {
    return null;
  }
}

/**
 * Executes a bounded diagnostic entirely from saved server configuration.
 * Results are ephemeral and do not persist or modify capability authority.
 */
export function createOllamaVerificationCompatibilityMatrixService({
  database = db,
  ollamaClient = null,
  createSavedOllamaClient = createOllamaVerificationSavedConfigurationClient,
  loadConfiguration = loadOllamaVerificationCapabilityConfiguration,
  selectModels = selectOllamaVerificationCompatibilityMatrixModels,
  buildReport = buildOllamaVerificationCompatibilityMatrixReport,
  probeModel = probeOllamaVerificationCompatibilityMatrixModel,
} = {}) {
  let inFlight = false;

  return Object.freeze({
    async run() {
      if (inFlight) {
        throw new OllamaVerificationCompatibilityMatrixInProgressError();
      }

      inFlight = true;
      try {
        const configuration = await loadConfiguration(database);
        const identity = resolveOllamaVerificationCapabilityIdentity(configuration || {});
        if (!identity.applicable) {
          return buildReport({
            stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.NOT_APPLICABLE,
          });
        }

        let savedOllamaClient;
        try {
          savedOllamaClient = ollamaClient || createSavedOllamaClient({ configuration });
        } catch {
          return buildReport({
            stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.UNAVAILABLE,
          });
        }

        let preflight;
        try {
          preflight = await savedOllamaClient.preflightConnection({
            force: true,
            includeModels: true,
            probeGeneration: false,
            cacheMs: 0,
          });
        } catch {
          return buildReport({
            stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.UNAVAILABLE,
          });
        }

        if (!preflight?.success) {
          return buildReport({
            stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.UNAVAILABLE,
          });
        }

        const selection = selectModels(preflight.models, identity.model);
        if (selection.models.length === 0) {
          return buildReport({
            stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.NO_LOCAL_MODELS,
            selection,
          });
        }

        const ollamaVersion = await loadSafeOllamaVersion(
          () => savedOllamaClient.getVersion({ timeoutMs: 5000 }),
        );
        const outcomes = [];
        for (const model of selection.models) {
          outcomes.push(await probeModel({
            modelName: model.name,
            ollamaClient: savedOllamaClient,
          }));
        }

        return buildReport({
          stateId: OLLAMA_VERIFICATION_COMPATIBILITY_MATRIX_STATE_IDS.COMPLETED,
          ollamaVersion,
          selection,
          outcomes,
        });
      } finally {
        inFlight = false;
      }
    },
  });
}
