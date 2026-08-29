/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { ollamaService } from './ollama.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  resolveOllamaVerificationCapabilityIdentity,
} from './ollamaVerificationCapabilityIdentity.mjs';
import {
  probeOllamaVerificationCapability,
} from './ollamaVerificationCapabilityProbe.mjs';
import {
  loadOllamaVerificationCapabilityConfiguration,
  persistOllamaVerificationCapabilityProbe,
} from './ollamaVerificationCapabilityRepository.mjs';
import {
  recordOllamaVerificationCapabilityOutcomeHistory,
} from './ollamaVerificationCapabilityOutcomeHistoryRepository.mjs';

/**
 * @typedef {{
 *   query: (...args: any[]) => Promise<any>,
 *   withTransaction: (callback: (client: { query: (...args: any[]) => Promise<any> }) => Promise<any>) => Promise<any>,
 * }} OllamaVerificationCapabilityDatabase
 */

/**
 * @typedef {{
 *   preflightConnection: (options: Record<string, unknown>) => Promise<any>,
 *   generate: (prompt: string, model: string, temperature: number, options: Record<string, unknown>) => Promise<string>,
 * }} OllamaVerificationCapabilityClient
 */

/**
 * Separates the remote probe from the short persistence transaction so a slow
 * local model never holds the AI-settings write lock. Persistence rechecks the
 * configuration identity under lock and rejects stale outcomes.
 *
 * @param {{
 *   database?: OllamaVerificationCapabilityDatabase,
 *   ollamaClient?: OllamaVerificationCapabilityClient,
 *   loadConfiguration?: (database: OllamaVerificationCapabilityDatabase) => Promise<Record<string, unknown> | null>,
 *   runProbe?: (options: { identity: Record<string, unknown>, ollamaClient: OllamaVerificationCapabilityClient }) => Promise<Record<string, unknown>>,
 *   persistProbe?: (options: {
 *     client: { query: (...args: any[]) => Promise<any> },
 *     identity: Record<string, unknown>,
 *     outcome: Record<string, unknown>,
 *   }) => Promise<Record<string, unknown> | null>,
 *   recordOutcomeHistory?: (database: OllamaVerificationCapabilityDatabase, statusId: string) => Promise<void>,
 *   logger?: { warn: (message: string, payload?: Record<string, unknown>) => void },
 * }} options
 */
export function createOllamaVerificationCapabilityService({
  database = db,
  ollamaClient = ollamaService,
  loadConfiguration = loadOllamaVerificationCapabilityConfiguration,
  runProbe = probeOllamaVerificationCapability,
  persistProbe = persistOllamaVerificationCapabilityProbe,
  recordOutcomeHistory = recordOllamaVerificationCapabilityOutcomeHistory,
  logger = createLogger('OllamaVerificationCapability'),
} = {}) {
  return Object.freeze({
    async testSavedConfiguration() {
      const configuration = await loadConfiguration(database);
      const identity = resolveOllamaVerificationCapabilityIdentity(configuration || {});
      const outcome = await runProbe({ identity, ollamaClient });

      // The route is only shown for a primary Ollama configuration, but keep
      // this service safe for direct callers as well. There is no applicable
      // persisted capability state to update when Ollama is not primary.
      if (!identity.applicable) {
        return outcome;
      }

      await database.withTransaction(async (client) => {
        await persistProbe({ client, identity, outcome });
      });

      // This aggregate is operational context only. A history write must not
      // change the tested capability, route media, or make local verification
      // unavailable when its bounded telemetry store is temporarily down.
      if (typeof outcome.statusId === 'string') {
        try {
          await recordOutcomeHistory(database, outcome.statusId);
        } catch {
          logger.warn('Ollama verification outcome history recording failed', {
            failureCode: 'persistence_unavailable',
          });
        }
      }

      return outcome;
    },
  });
}
