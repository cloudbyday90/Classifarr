/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as sleepFor } from 'node:timers/promises';
import * as db from '../config/database.mjs';
import { embeddingService } from './embeddingService.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('IdleBackfillProcessing');

export async function runIdleBackfillLoop(deps) {
  const {
    batchSize,
    runId,
    isIdle,
    getPendingEmbeddings,
    getManualBackfillStatus,
    sleep = (ms) => sleepFor(ms),
  } = deps;

  let totalProcessed = 0;
  let deferredForBusy = false;
  let running = true;

  while (running && isIdle()) {
    const pending = await getPendingEmbeddings(batchSize);

    if (pending.length === 0) {
      logger.info('No pending embeddings, idle backfill complete');
      break;
    }

    for (const item of pending) {
      if (!isIdle()) {
        logger.info('Classification activity detected, pausing idle backfill');
        running = false;
        break;
      }

      if (getManualBackfillStatus) {
        const manualStatus = await getManualBackfillStatus();
        if (manualStatus.status === 'running') {
          logger.info('Manual backfill started, stopping idle backfill');
          running = false;
          break;
        }
      }

      if (!running) break;

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
          logger.debug('Idle backfill item was not stored; leaving it pending', {
            id: item.id,
            title: item.title
          });
          continue;
        }

        totalProcessed++;

        await db.query(
          'UPDATE backfill_runs SET processed = $1 WHERE id = $2',
          [totalProcessed, runId]
        );
      } catch (error) {
        if (error.message === 'PROVIDER_OFFLINE') {
          const offlineStatus = embeddingService.getProviderAvailabilityStatus();
          logger.warn('Provider offline detected - deferring idle backfill until recovery probe succeeds', {
            retryAt: offlineStatus.cooldownUntil
          }, { skipDbPersist: true });

          running = false;
          break;
        }

        if (embeddingService.isProviderBusyError(error)) {
          deferredForBusy = true;
          logger.info('Idle backfill yielded to active provider traffic', {
            id: item.id,
            title: item.title,
            lockHolder: error.lockHolder || null,
            waitMs: error.waitMs || null,
            activeModel: error.activeModel || null
          });
          running = false;
          break;
        }

        logger.error('Failed to generate embedding in idle backfill', {
          id: item.id,
          title: item.title,
          error: error.message
        }, { error });
      }
    }

    if (running && isIdle()) {
      await sleep(1000);
    }
  }

  return { totalProcessed, deferredForBusy };
}
