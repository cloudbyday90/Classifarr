/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildClassificationDecisionPathTelemetry,
  buildClassificationDecisionPathTelemetryWindow,
} from './classificationDecisionPathTelemetry.mjs';
import {
  loadClassificationDecisionPathTelemetry,
} from './classificationDecisionPathTelemetryRepository.mjs';

/**
 * Provides a bounded, read-only decision-path snapshot for the queue view.
 * Telemetry failures fail open so observability cannot interrupt queue status.
 */
export function createClassificationDecisionPathTelemetryService({
  database = db,
  loadAggregate = loadClassificationDecisionPathTelemetry,
  buildWindow = buildClassificationDecisionPathTelemetryWindow,
  buildTelemetry = buildClassificationDecisionPathTelemetry,
  logger = null,
  now = () => new Date(),
  cacheTtlMs = 5_000,
} = {}) {
  let cachedTelemetry = null;
  let cacheExpiresAt = 0;
  let hasCachedTelemetry = false;

  return Object.freeze({
    async getTelemetry({ queueStats } = {}) {
      const pending = Number(queueStats?.pending);
      if (!Number.isSafeInteger(pending) || pending <= 0) {
        return null;
      }

      let currentTime = Date.now();
      try {
        const observedAt = now();
        if (!(observedAt instanceof Date) || Number.isNaN(observedAt.getTime())) {
          throw new TypeError('A valid observation time is required.');
        }

        currentTime = observedAt.getTime();
        if (hasCachedTelemetry && currentTime < cacheExpiresAt) {
          return cachedTelemetry;
        }

        const window = buildWindow({ now: observedAt });
        const aggregate = await loadAggregate(database, window);
        cachedTelemetry = buildTelemetry({ aggregate, window });
      } catch (error) {
        logger?.warn?.('Queue decision-path telemetry could not read aggregate history', {
          error: error.message,
        });
        cachedTelemetry = null;
      }

      hasCachedTelemetry = true;
      cacheExpiresAt = currentTime + cacheTtlMs;
      return cachedTelemetry;
    },
  });
}
