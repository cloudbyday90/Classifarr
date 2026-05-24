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
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ScheduledBackfillProcessing');

export async function runScheduledBackfillLoop(deps) {
  const {
    batchSize,
    runId,
    maxDuration,
    startTime,
    shouldContinue,
    signalStop,
    includeImage,
  } = deps;

  let processed = 0;
  let providerUnavailable = false;
  let providerBusy = false;

  while (shouldContinue.value && Date.now() - startTime < maxDuration) {
    const pending = await embeddingService.getPendingEmbeddings({
      limit: batchSize,
      includeImage,
    });

    if (pending.length === 0) {
      logger.info('No more pending embeddings');
      break;
    }

    for (const item of pending) {
      if (!shouldContinue.value) {
        logger.info('Scheduled backfill stop requested, ending active run');
        break;
      }

      if (Date.now() - startTime >= maxDuration) {
        logger.info('Max duration reached, stopping scheduled backfill');
        break;
      }

      try {
        let generationResult = null;
        if (item.needsText) {
          generationResult = await embeddingService.generateAndStore(item.id, {
            ...item.metadata,
            title: item.title,
            media_type: item.media_type,
            library_name: item.library_name
          });
        } else if (item.needsImage) {
          generationResult = await embeddingService.generateImageEmbedding(item.id, {
            ...item.metadata,
            title: item.title,
            media_type: item.media_type,
            library_name: item.library_name
          });
        }

        if (!generationResult) {
          logger.debug('Scheduled backfill item was not stored; leaving it pending', {
            id: item.id,
            title: item.title
          });
          continue;
        }

        processed++;

        if (processed % 10 === 0) {
          await db.query(
            'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
            [processed, runId]
          );
        }
      } catch (error) {
        if (error.message === 'PROVIDER_OFFLINE') {
          providerUnavailable = true;
          const offlineStatus = embeddingService.getProviderAvailabilityStatus();
          logger.warn('Scheduled backfill paused: embedding provider unavailable', {
            retryAt: offlineStatus.cooldownUntil
          }, { skipDbPersist: true });
          signalStop();
          break;
        }

        if (embeddingService.isProviderBusyError(error)) {
          providerBusy = true;
          logger.info('Scheduled backfill yielded to active provider traffic', {
            id: item.id,
            title: item.title,
            lockHolder: error.lockHolder || null,
            waitMs: error.waitMs || null,
            activeModel: error.activeModel || null
          });
          signalStop();
          break;
        }

        logger.error('Failed to generate embedding in scheduled backfill', {
          id: item.id,
          title: item.title,
          error: error.message
        }, { error });
      }
    }
  }

  return { processed, providerUnavailable, providerBusy };
}
