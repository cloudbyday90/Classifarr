/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createReclassificationMoveAdapter } from './reclassificationMoves.mjs';
import { createReclassificationMoveRepository } from './reclassificationMoveRepository.mjs';
import { classificationMoveRevision, moveBlocked } from './reclassificationMoveContract.mjs';
import { previewReclassification, triggerPlexScan } from './reclassificationQueries.mjs';
import { positiveDatabaseInteger } from './mediaIdentityValues.mjs';
import { NotFoundError, ValidationError, AppError } from '../utils/appError.mjs';

export class ReclassificationService {
  constructor({ database = db, repository = createReclassificationMoveRepository(database),
    adapter = createReclassificationMoveAdapter({ database }), logger = createLogger('ReclassificationService'),
    scan = triggerPlexScan } = {}) {
    this.db = database;
    this.repository = repository;
    this.adapter = adapter;
    this.logger = logger;
    this.scan = scan;
  }

  async exclusive(callback) {
    let result;
    const acquired = await this.db.withSessionAdvisoryLock(
      db.DB_ADVISORY_LOCKS.RECLASSIFICATION_MOVE,
      async ({ signal } = {}) => { result = await callback({ signal }); },
    );
    if (!acquired) throw new AppError('Another media move or recovery check is active. Retry shortly.', 409, { code: 'move_busy' });
    return result;
  }

  async executeReclassification({ classificationId, targetLibraryId, correctedBy = 'user', batchItemId = null }) {
    classificationId = positiveDatabaseInteger(classificationId);
    targetLibraryId = positiveDatabaseInteger(targetLibraryId);
    if ((batchItemId !== null && !positiveDatabaseInteger(batchItemId)) || !classificationId || !targetLibraryId || typeof correctedBy !== 'string' ||
        !correctedBy.trim() || correctedBy.length > 100) {
      throw new ValidationError('Valid classification/destination IDs and an actor of 1–100 characters are required.');
    }
    return this.exclusive(async options => {
      const existing = await this.repository.find(classificationId);
      const classification = await this.repository.classification(classificationId);
      if (existing && existing.state !== 'completed') {
        if (existing.target_library_id !== targetLibraryId) {
          throw moveBlocked('move_target_conflict', 'This classification already has an unfinished move. Retry its original destination; do not start a second move.');
        }
        if (batchItemId !== null) await this.repository.bind(existing, batchItemId);
        return this.resume(existing, options);
      }
      if (!classification) throw new NotFoundError('Classification not found');
      if (classification.library_id === targetLibraryId) {
        if (existing?.target_library_id === targetLibraryId &&
            classificationMoveRevision({ ...classification, library_id: existing.plan.originalLibraryId,
              status: existing.plan.classificationStatus ?? null }) === existing.plan.classificationRevision) {
          return this.result(existing, classification.title);
        }
        throw new ValidationError('This item is already assigned to the destination library; no move was started.');
      }
      const plan = await this.adapter.prepare(classification, targetLibraryId, options);
      options.signal?.throwIfAborted();
      const operation = await this.repository.reserve(classificationId, targetLibraryId, correctedBy, plan, batchItemId);
      // Only the request which durably reserved the intent may start filesystem work.
      try { await this.adapter.moveFiles(plan, options); }
      catch (error) { return this.failed(operation, error); }
      return this.resume(operation, options);
    });
  }

  async resume(operation, options) {
    try {
      await this.repository.attempted(operation.id);
      const classification = await this.repository.classification(operation.classification_id);
      if (!classification || classificationMoveRevision(classification) !== operation.plan.classificationRevision) {
        throw moveBlocked('move_classification_changed', 'Classification changed or was removed during the move. Inspect history and actual placement before applying another correction.');
      }
      options.signal?.throwIfAborted();
      await this.adapter.reconcile(operation.plan, options);
      await this.repository.verified(operation.id);
      options.signal?.throwIfAborted();
      await this.repository.complete(operation);
      this.logger.info('Reclassification move reconciled', { operationId: operation.id, classificationId: operation.classification_id });
      // A scan is a best-effort notification, never evidence of file movement.
      try {
        const scan = await this.scan({ targetLibraryId: operation.target_library_id,
          originalLibraryId: operation.plan.originalLibraryId, newPath: operation.plan.newPath, oldPath: operation.plan.oldPath });
        if (scan?.success === false) this.logger.warn('Move completed; Plex scan will require a library refresh', { operationId: operation.id });
      } catch { this.logger.warn('Move completed; Plex scan will require a library refresh', { operationId: operation.id }); }
      return this.result(operation, classification.title);
    } catch (error) { return this.failed(operation, error); }
  }

  async failed(operation, error) {
    const blocked = error instanceof ValidationError && error.code?.startsWith('move_');
    const reason = blocked ? error.code : 'move_dependency_unavailable';
    const message = blocked ? error.message :
      'Move completion is unconfirmed. Scheduled recovery will verify the files and Radarr/Sonarr state before finishing. Do not move or delete either folder while recovery is pending.';
    // If the connection/lock was lost, this write fails closed; the original reservation remains.
    const updated = await this.repository.defer(operation, reason, blocked);
    if (updated && operation.reason_code !== reason) {
      this.logger.warn('Reclassification move requires recovery', {
        operationId: operation.id, classificationId: operation.classification_id, reason, recovery: message,
      });
    }
    throw new AppError(`${message} Recovery reference: ${operation.id}.`, blocked ? 409 : 503,
      { code: reason, isOperational: true });
  }

  result(operation, title) {
    return { success: true, message: `Successfully moved "${title}" to new library`,
      details: { title, mediaType: operation.plan.mediaType, newPath: operation.plan.newPath,
        movedIn: operation.plan.mediaType === 'movie' ? 'radarr' : 'sonarr' },
      // Legacy response compatibility only; never promises automatic physical rollback.
      rollbackInfo: { executed: true, originalData: { libraryId: operation.plan.originalLibraryId, arrConfig: null } },
    };
  }

  async recoverDue() {
    try {
      return await this.exclusive(async options => {
        await this.repository.prune();
        const operation = await this.repository.due();
        if (!operation) return { status: 'idle' };
        try { await this.resume(operation, options); return { status: 'completed' }; }
        catch (error) {
          if (error instanceof AppError && error.code?.startsWith('move_')) return { status: 'deferred' };
          throw error;
        }
      });
    } catch (error) {
      if (error.code === 'move_busy') return { status: 'busy' };
      throw error;
    }
  }

  async previewReclassification(params) { return previewReclassification(params); }
}

export const reclassificationService = new ReclassificationService();
