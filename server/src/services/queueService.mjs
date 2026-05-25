/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ==========================================================================
 * DEPENDENCY INJECTION PATTERN
 * ==========================================================================
 *
 * This service uses dependency injection (DI) for testability and isolation.
 *
 * WHY: Previously, this was a singleton with module-level requires. This caused
 * test pollution where mocked dependencies would bleed between test files,
 * resulting in flaky tests (~50% failure rate in enrichmentPipeline.test.js).
 *
 * HOW IT WORKS:
 * - Default dependencies are loaded at module level (for production use)
 * - Constructor accepts an optional `deps` object to override any dependency
 * - The singleton export uses all defaults (backward compatible)
 * - Tests can import `QueueService` class and inject mocked dependencies
 *
 * USAGE IN TESTS:
 *   import queueService, { QueueService } from '../services/queueService.mjs';
 *   const mockDb = { query: jest.fn() };
 *   const queueService = new QueueService({ db: mockDb, tmdbService: mockTmdb });
 *
 * USAGE IN PRODUCTION (unchanged):
 *   import queueService from './queueService.mjs'; // Uses default singleton
 *
 * ==========================================================================
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { classificationService as defaultClassificationService } from './classification.mjs';
import { ollamaService as defaultOllamaService } from './ollama.mjs';
import { aiRouterService as defaultAiRouterService } from './aiRouter.mjs';
import { syncStatus as defaultSyncStatus } from './syncStatus.mjs';
import { tmdbService as defaultTmdbService } from './tmdb.mjs';
import { omdbService as defaultOmdbService } from './omdb.mjs';
import { enrichmentRetryService as defaultEnrichmentRetryService } from './enrichmentRetryService.mjs';
import { classificationEvidenceService } from './classificationEvidenceService.mjs';
import { QueueReadModel } from './queueReadModel.mjs';
import { QueueMutationService } from './queueMutationService.mjs';
import { QueueAdminService } from './queueAdminService.mjs';
import { QueueCarsaService } from './queueCarsaService.mjs';
import { QueueWorkerLoopService } from './queueWorkerLoopService.mjs';
import { QueueTaskProcessorService } from './queueTaskProcessorService.mjs';
import { QueueRefillService } from './queueRefillService.mjs';
import { queueMaintenanceService as defaultQueueMaintenanceService } from './queueMaintenanceService.mjs';
import { QueueConcurrencySettingsService } from './queueConcurrencySettingsService.mjs';

const POLL_INTERVAL_MS = 1000;
const HARD_MAX_CONCURRENT = 25;
const RETRY_DELAYS = [30, 60, 120, 300, 600];
const OMDB_CIRCUIT_WARN_THROTTLE_MS = 60000;
const VISIBILITY_TIMEOUT_MINUTES = parseInt(process.env.TASK_VISIBILITY_TIMEOUT_MINUTES || '10', 10);
const VISIBILITY_RECOVERY_INTERVAL_MS = 60_000;

export class QueueService {
  constructor(deps = {}) {
    this.db = deps.db || defaultDb;
    this.classificationService = deps.classificationService || defaultClassificationService;
    this.ollamaService = deps.ollamaService || defaultOllamaService;
    this.aiRouterService = deps.aiRouterService || defaultAiRouterService;
    this.syncStatus = deps.syncStatus || defaultSyncStatus;
    this.tmdbService = deps.tmdbService || defaultTmdbService;
    this.omdbService = deps.omdbService || defaultOmdbService;
    this.enrichmentRetryService = deps.enrichmentRetryService || defaultEnrichmentRetryService;
    this.evidenceService = deps.evidenceService || classificationEvidenceService;
    this.logger = deps.logger || createLogger('QueueService');
    this.queueMaintenanceService = deps.queueMaintenanceService || defaultQueueMaintenanceService;
    this.scheduler = deps.scheduler || null;
    this.processingByType = {
      metadata_enrichment: 0,
    };
    this.queueConcurrencySettingsService = deps.queueConcurrencySettingsService || new QueueConcurrencySettingsService({
      db: this.db,
      logger: this.logger,
    });

    this.running = false;
    this.processing = 0;
    this.aiAvailable = true;
    this.lastRecoveryCheck = 0;
    this.fullConcurrencyStartedAt = 0;
    this.lastAiAvailabilityProbeAt = 0;

    this.queueReadModel = deps.queueReadModel || new QueueReadModel({
      db: this.db,
      logger: this.logger,
      getDispatchBlockers: () => this.hasClassificationDispatchBlocker(),
      getRuntimeState: () => ({
        aiAvailable: this.aiAvailable,
        workerRunning: this.running,
        queueConcurrency: this.queueConcurrencySettingsService.cachedConfig || this.queueConcurrencySettingsService.buildDefaultConfig(),
      }),
      getSyncStatus: () => this.syncStatus.getStatus(),
      enrichmentRetryService: this.enrichmentRetryService,
    });
    this.queueMutationService = deps.queueMutationService || new QueueMutationService({
      db: this.db,
      logger: this.logger,
      enqueueTask: (...args) => this.enqueue(...args),
    });
    this.queueAdminService = deps.queueAdminService || new QueueAdminService({
      db: this.db,
      logger: this.logger,
      classificationService: this.classificationService,
    });
    this.queueCarsaService = deps.queueCarsaService || new QueueCarsaService({
      db: this.db,
      logger: this.logger,
      syncStatus: this.syncStatus,
      evidenceService: this.evidenceService,
      getScheduler: async () => {
        if (!this.scheduler) {
          throw new Error('Scheduler service is not configured');
        }

        return this.scheduler;
      },
      getWorkerState: () => ({
        running: this.running,
        processing: this.processing,
      }),
      startWorker: (...args) => this.startWorker(...args),
      stopWorker: (...args) => this.stopWorker(...args),
      captureLibrarySnapshot: (...args) => this.buildLibrarySnapshot(...args),
      buildLibraryLookup: (...args) => this.buildNewLibraryLookup(...args),
      remapMappings: (...args) => this.remapAllArrMappings(...args),
      notifyRemapFailures: (...args) => this.createRemapFailureNotification(...args),
      performCleanup: (...args) => this.performClearAndResyncCleanup(...args),
      resetVolatileState: () => this.queueTaskProcessorService.resetOmdbState(),
    });
    this.queueWorkerLoopService = deps.queueWorkerLoopService || new QueueWorkerLoopService({
      db: this.db,
      logger: this.logger,
      aiRouterService: this.aiRouterService,
      ollamaService: this.ollamaService,
      getState: () => ({
        running: this.running,
        processing: this.processing,
        processingByType: { ...this.processingByType },
        lastRecoveryCheck: this.lastRecoveryCheck,
        fullConcurrencyStartedAt: this.fullConcurrencyStartedAt,
        aiAvailable: this.aiAvailable,
        lastAiAvailabilityProbeAt: this.lastAiAvailabilityProbeAt,
      }),
      setRunning: (running) => {
        this.running = running;
      },
      incrementProcessing: (taskType) => {
        this.processing += 1;
        this.processingByType[taskType] = (this.processingByType[taskType] || 0) + 1;
      },
      decrementProcessing: (taskType) => {
        this.processing = Math.max(0, this.processing - 1);
        if (taskType) {
          this.processingByType[taskType] = Math.max(0, (this.processingByType[taskType] || 0) - 1);
        }
      },
      setLastRecoveryCheck: (value) => {
        this.lastRecoveryCheck = value;
      },
      setFullConcurrencyStartedAt: (value) => {
        this.fullConcurrencyStartedAt = value;
      },
      setLastAiAvailabilityProbeAt: (value) => {
        this.lastAiAvailabilityProbeAt = value;
      },
      setAiAvailable: (value) => {
        this.aiAvailable = value;
      },
      backgroundDrainIfBloated: (...args) => this.queueMaintenanceService.backgroundDrainIfBloated(...args),
      hasClassificationDispatchBlocker: (...args) => this.hasClassificationDispatchBlocker(...args),
      getConcurrencySettings: () => this.queueConcurrencySettingsService.getConfig(),
      dequeue: (...args) => this.dequeue(...args),
      processTask: (...args) => this.processTask(...args),
      pollIntervalMs: POLL_INTERVAL_MS,
      maxConcurrent: HARD_MAX_CONCURRENT,
      visibilityRecoveryIntervalMs: VISIBILITY_RECOVERY_INTERVAL_MS,
    });
    this.queueTaskProcessorService = deps.queueTaskProcessorService || new QueueTaskProcessorService({
      db: this.db,
      logger: this.logger,
      classificationService: this.classificationService,
      omdbService: this.omdbService,
      tmdbService: this.tmdbService,
      completeTask: (...args) => this.completeTask(...args),
      failTask: (...args) => this.failTask(...args),
      omdbCircuitWarnThrottleMs: OMDB_CIRCUIT_WARN_THROTTLE_MS,
    });
    this.queueRefillService = deps.queueRefillService || new QueueRefillService({
      db: this.db,
      logger: this.logger,
      enqueueTask: (...args) => this.enqueue(...args),
    });
  }

  async _withCatch(label, context, fn) {
    if (typeof context === 'function') {
      fn = context;
      context = {};
    }
    try {
      return await fn();
    } catch (error) {
      this.logger.error(label, { error: error.message, ...context });
      throw error;
    }
  }

  async isOmdbSslBlocked(omdbApiKey, title) {
    return this.queueTaskProcessorService.isOmdbSslBlocked(omdbApiKey, title);
  }

  async enqueue(taskType, payload, options = {}) {
    const { priority = 0, webhookLogId = null, source = 'webhook', maxAttempts = 5 } = options;

    return this._withCatch('Failed to enqueue task', { taskType }, async () => {
      const result = await this.db.query(
        `INSERT INTO task_queue (task_type, payload, priority, webhook_log_id, source, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [taskType, JSON.stringify(payload), priority, webhookLogId, source, maxAttempts],
      );

      const taskId = result.rows[0].id;
      this.logger.info('Task enqueued', { taskId, taskType, source });
      return taskId;
    });
  }

  async hasClassificationDispatchBlocker() {
    const now = Date.now();
    if (this._blockerCache && now < this._blockerCacheExpiresAt) {
      return this._blockerCache;
    }

    try {
      const result = await this.db.query(
        `SELECT
            EXISTS (
                SELECT 1
                FROM task_queue
                WHERE task_type = 'classification'
                  AND status = 'processing'
            ) AS has_processing_classification`,
        [],
      );

      const row = result.rows[0] || {};

      const value = {
        hasProcessingClassification: row.has_processing_classification === true,
        lookupFailed: false,
      };
      this._blockerCache = value;
      this._blockerCacheExpiresAt = Date.now() + 250;
      return value;
    } catch (error) {
      this.logger.error('Failed to check classification dispatch blockers', { error: error.message });
      return {
        hasProcessingClassification: false,
        lookupFailed: true,
      };
    }
  }

  async dequeue(options = {}) {
    const { excludeClassification = false, excludeTaskTypes = [], onlyTaskTypes = [] } = options;
    const classificationFilter = excludeClassification ? "AND task_type <> 'classification'" : '';
    const excludedTaskTypes = Array.isArray(excludeTaskTypes) ? excludeTaskTypes.filter(Boolean) : [];
    const includedTaskTypes = Array.isArray(onlyTaskTypes) ? onlyTaskTypes.filter(Boolean) : [];
    const params = [];
    const excludeTaskTypeFilter = excludedTaskTypes.length > 0
      ? `AND task_type <> ALL($${params.push(excludedTaskTypes)}::text[])`
      : '';
    const includeTaskTypeFilter = includedTaskTypes.length > 0
      ? `AND task_type = ANY($${params.push(includedTaskTypes)}::text[])`
      : '';

    try {
      const result = await this.db.query(
        `UPDATE task_queue
         SET status = 'processing', started_at = NOW(),
             visible_at = NOW() + INTERVAL '${VISIBILITY_TIMEOUT_MINUTES} minutes'
         WHERE id = (
           SELECT id FROM task_queue
           WHERE (
                 (status = 'pending' AND next_retry_at <= NOW())
              OR (status = 'processing'
                  AND visible_at IS NOT NULL
                  AND visible_at <= NOW())
           )
             ${classificationFilter}
             ${excludeTaskTypeFilter}
             ${includeTaskTypeFilter}
           ORDER BY priority DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        params,
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Failed to dequeue task', { error: error.message });
      return null;
    }
  }

  async completeTask(taskId, result = {}) {
    try {
      await this.db.query(
        `UPDATE task_queue
         SET status = 'completed', completed_at = NOW(), visible_at = NULL, payload = payload || $2
         WHERE id = $1`,
        [taskId, JSON.stringify({ result })],
      );
      this.logger.info('Task completed', { taskId });
    } catch (error) {
      this.logger.error('Failed to complete task', { error: error.message, taskId });
    }
  }

  async failTask(taskId, errorMessage, currentAttempts, maxAttempts) {
    const nextAttempt = currentAttempts + 1;

    try {
      if (nextAttempt >= maxAttempts) {
        await this.db.query(
          `UPDATE task_queue
           SET status = 'failed', error_message = $2, attempts = $3, completed_at = NOW()
           WHERE id = $1`,
          [taskId, errorMessage, nextAttempt],
        );
        this.logger.error('Task permanently failed', { taskId, attempts: nextAttempt });
      } else {
        const delaySeconds = RETRY_DELAYS[Math.min(nextAttempt - 1, RETRY_DELAYS.length - 1)];
        await this.db.query(
          `UPDATE task_queue
           SET status = 'pending', error_message = $2, attempts = $3,
               next_retry_at = NOW() + INTERVAL '${delaySeconds} seconds',
               started_at = NULL, visible_at = NULL
           WHERE id = $1`,
          [taskId, errorMessage, nextAttempt],
        );
        this.logger.warn('Task scheduled for retry', { taskId, attempt: nextAttempt, delaySeconds });
      }
    } catch (error) {
      this.logger.error('Failed to update task status', { error: error.message, taskId });
    }
  }

  async checkAIAvailability() {
    return this.queueWorkerLoopService.checkAIAvailability();
  }

  async processRatingNormalization(task) {
    return this.queueTaskProcessorService.processRatingNormalization(task);
  }

  async processTask(task) {
    return this.queueTaskProcessorService.processTask(task);
  }

  async resetStaleProcessingTasks() {
    return this.queueWorkerLoopService.resetStaleProcessingTasks();
  }

  async startWorker() {
    return this.queueWorkerLoopService.startWorker();
  }

  stopWorker() {
    this.running = false;
    this.processingByType = {
      metadata_enrichment: 0,
    };
    this.logger.info('Queue worker stopping...');
  }

  async recoverExpiredVisibilityTasks() {
    return this.queueWorkerLoopService.recoverExpiredVisibilityTasks();
  }

  async gracefulShutdown() {
    this.processingByType = {
      metadata_enrichment: 0,
    };
    return this.queueWorkerLoopService.gracefulShutdown();
  }

  async refreshConcurrencySettings() {
    this.queueConcurrencySettingsService.invalidate();
    return this.queueConcurrencySettingsService.getConfig();
  }

  async getStats() {
    return this.queueReadModel.getStats();
  }

  async getGapAnalysisStats() {
    return this.queueReadModel.getGapAnalysisStats();
  }

  async getLiveStats() {
    return this.queueReadModel.getLiveStats();
  }

  async getPendingTasks(limit = 20) {
    return this.queueReadModel.getPendingTasks(limit);
  }

  async getFailedTasks(limit = 20) {
    return this.queueReadModel.getFailedTasks(limit);
  }

  async getEnrichmentRetryStats() {
    return this.enrichmentRetryService.getStats();
  }

  getOllamaStatus() {
    return this.ollamaService.getGenerationStatus();
  }

  async processEnrichmentRetryQueue(limit = 50, enrichmentType = 'tavily') {
    return this.enrichmentRetryService.processRetryQueue(limit, enrichmentType);
  }

  async backfillEnrichmentRetryQueue() {
    return this.enrichmentRetryService.backfillRetryQueue();
  }

  async retryTask(taskId) {
    return this.queueMutationService.retryTask(taskId);
  }

  async dismissFailedTask(taskId) {
    return this.queueMutationService.dismissFailedTask(taskId);
  }

  async cancelTask(taskId) {
    return this.queueMutationService.cancelTask(taskId);
  }

  async manualClassifyTask(taskId, libraryId, resolvedBy = 'admin') {
    return this.queueAdminService.manualClassifyTask(taskId, libraryId, resolvedBy);
  }

  async clearCompletedTasks() {
    return this.queueMutationService.clearCompletedTasks();
  }

  async clearFailedTasks() {
    return this.queueMutationService.clearFailedTasks();
  }

  async retryAllFailedTasks() {
    return this.queueMutationService.retryAllFailedTasks();
  }

  async cancelAllPendingTasks() {
    return this.queueMutationService.cancelAllPendingTasks();
  }

  async reprocessCompleted() {
    return this.queueMutationService.reprocessCompleted();
  }

  async buildLibrarySnapshot() {
    return this.queueCarsaService.buildLibrarySnapshot();
  }

  async buildNewLibraryLookup() {
    return this.queueCarsaService.buildNewLibraryLookup();
  }

  findNewLibraryId(oldLibInfo, newLookup) {
    return this.queueCarsaService.findNewLibraryId(oldLibInfo, newLookup);
  }

  async remapInstanceMappings(type, config, snapshot, newLookup) {
    return this.queueCarsaService.remapInstanceMappings(type, config, snapshot, newLookup);
  }

  async remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup) {
    return this.queueCarsaService.remapAllArrMappings(oldLibrarySnapshot, newLibraryLookup);
  }

  async createRemapFailureNotification(results) {
    return this.queueCarsaService.createRemapFailureNotification(results);
  }

  async withOptionalTransaction(work, context = 'transaction') {
    return this.queueCarsaService.withOptionalTransaction(work, context);
  }

  isForeignKeyConstraintError(error) {
    return this.queueCarsaService.isForeignKeyConstraintError(error);
  }

  normalizeClearAndResyncError(error) {
    return this.queueCarsaService.normalizeClearAndResyncError(error);
  }

  async performClearAndResyncCleanup() {
    return this.queueCarsaService.performClearAndResyncCleanup();
  }

  async clearAndResync() {
    return this.queueCarsaService.clearAndResync();
  }

  async refillQueue() {
    return this.queueRefillService.refillQueue();
  }

  setScheduler(schedulerService) {
    this.scheduler = schedulerService;
  }
}

export const queueService = new QueueService();
