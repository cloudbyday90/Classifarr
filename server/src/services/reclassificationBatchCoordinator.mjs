/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { AppError } from '../utils/appError.mjs';
import { reclassificationService } from './reclassificationService.mjs';
import { createBatchCoordinatorRepository } from './reclassificationBatchCoordinatorRepository.mjs';

export function createBatchCoordinator({ database = db,
  repository = createBatchCoordinatorRepository(database), service = reclassificationService } = {}) {
  return {
    async runOnce() {
      let outcome = { status: 'idle' };
      const acquired = await database.withSessionAdvisoryLock(db.DB_ADVISORY_LOCKS.RECLASSIFICATION_BATCH,
        async ({ signal } = {}) => {
          const claim = await repository.claim();
          if (!claim) return;
          const { batch, item, interrupted } = claim;
          signal?.throwIfAborted();
          const operationId = item.execution_result?.moveOperationId;
          if (interrupted && !operationId && item.execution_version !== 1) {
            await repository.failure(claim,
              'An older interrupted item has no move receipt. Inspect its source and destination in Radarr/Sonarr before retrying; no files were replayed.', true);
            outcome = { status: 'needs_attention' };
            return;
          }
          try {
            if (operationId !== undefined && operationId !== null) {
              const result = await service.recoverBatchItem({ operationId, batchItemId: item.id,
                classificationId: item.classification_id, targetLibraryId: item.target_library_id,
                retry: !interrupted, signal });
              if (result.status === 'waiting') await repository.defer(batch.id, 300);
              outcome = result;
            } else {
              const result = await service.executeReclassification({ classificationId: item.classification_id,
                targetLibraryId: item.target_library_id, correctedBy: batch.created_by, batchItemId: item.id, signal });
              signal?.throwIfAborted();
              await repository.success(item, result);
              outcome = { status: 'completed' };
            }
          } catch (error) {
            signal?.throwIfAborted();
            if (error.code === 'move_busy') {
              await repository.defer(batch.id);
              outcome = { status: 'busy' };
            } else if (error.code === 'move_batch_changed') {
              await repository.stopped(item);
              outcome = { status: 'stopped' };
            } else {
              const message = error instanceof AppError && error.isOperational
                ? error.message.slice(0, 1000)
                : 'Batch item could not finish. Check the move recovery status and integration health before retrying.';
              await repository.failure(claim, message, error.code === 'move_journal_missing');
              outcome = { status: 'failed' };
            }
          }
        });
      return acquired ? outcome : { status: 'busy' };
    },
  };
}
