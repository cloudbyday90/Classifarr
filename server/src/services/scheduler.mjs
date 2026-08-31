/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import cron from 'node-cron';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { queueService } from './queueService.mjs';
import { queueMaintenanceService } from './queueMaintenanceService.mjs';
import { TASK_QUEUE_CLEANUP_ORIGINS } from './queueMaintenanceRunContract.mjs';
import { schedulerRetentionService } from './schedulerRetentionService.mjs';
import { classificationMaintenanceService } from './classificationMaintenanceService.mjs';
import { ratingNormalizationQueueService } from './ratingNormalizationQueueService.mjs';
import { nativeIntentReconciliationService } from './nativeIntentReconciliationService.mjs';
import {
    NATIVE_INTENT_RECONCILIATION_CRON,
    NATIVE_INTENT_RECONCILIATION_INITIAL_DELAY_MS,
    NATIVE_INTENT_RECONCILIATION_TASK_NAME,
} from './nativeIntentReconciliationSchedule.mjs';
import {
    policyProfileRefreshAutomationService,
} from './policyProfileRefreshAutomationService.mjs';
import {
    POLICY_PROFILE_REFRESH_OUTBOX_CRON,
    POLICY_PROFILE_REFRESH_OUTBOX_INITIAL_DELAY_MS,
    POLICY_PROFILE_REFRESH_OUTBOX_TASK_NAME,
} from './policyProfileRefreshOutboxSchedule.mjs';
import {
    runGapAnalysis as _runGapAnalysis,
    runPeriodicLibrarySync as _runPeriodicLibrarySync,
    runLibraryWatchdog as _runLibraryWatchdog,
    processRetryQueue as _processRetryQueue,
    processEnrichmentRetryQueue as _processEnrichmentRetryQueue,
} from './schedulerOperationalTasks.mjs';
import { runAutoLearnRules as _runAutoLearnRules } from './schedulerAutoLearnRules.mjs';

const { withSessionAdvisoryLock, DB_ADVISORY_LOCKS } = db;
const logger = createLogger('SchedulerService');

class SchedulerService {
    constructor() {
        this.tasks = new Map();
        this.initialTaskTimers = new Map();
        this.ratingNormalizationQueueService = ratingNormalizationQueueService;
        queueService.setScheduler(this);
    }

    resetState() {
        for (const task of this.tasks.values()) {
            if (typeof task?.stop === 'function') {
                task.stop();
            }
        }
        this.tasks.clear();
        for (const timer of this.initialTaskTimers.values()) {
            clearTimeout(timer);
        }
        this.initialTaskTimers.clear();
        this.ratingNormalizationQueueService = ratingNormalizationQueueService;
    }

    /**
     * Initialize scheduled tasks
     */
    init() {
        logger.info('Initializing scheduler...');

        this.schedule('gap-analysis', '*/5 * * * *', () => this.runGapAnalysis(), DB_ADVISORY_LOCKS.GAP_ANALYSIS);

        setTimeout(() => this.runGapAnalysis(), 30000);

        this.schedule('library-watchdog', '*/5 * * * *', () => this.runLibraryWatchdog());

        setTimeout(() => this.runLibraryWatchdog(), 5000);

        // DISABLED: Auto-learn rules - feature removed as it creates duplicates
        // and makes assumptions that don't work for diverse library naming conventions.
        // Users should manage classification behavior via Policies, Presets, and Tuning.
        // this.schedule('auto-learn-rules', '*/30 * * * *', () => this.runAutoLearnRules());
        // setTimeout(() => this.runAutoLearnRules(), 120000);


        // Periodic library sync every 6 hours to keep Plex data fresh
        this.schedule('library-sync', '0 */6 * * *', () => this.runPeriodicLibrarySync(), DB_ADVISORY_LOCKS.LIBRARY_SYNC);

        setTimeout(() => this.runPeriodicLibrarySync(), 120000);

        // Process retry queue every 5 minutes for AI-unavailable retries
        this.schedule('retry-queue', '*/5 * * * *', () => this.processRetryQueue(), DB_ADVISORY_LOCKS.RETRY_QUEUE);

        setTimeout(() => this.processRetryQueue(), 60000);

        // Process enrichment retry queue every 6 hours as safety net for OMDb and Tavily
        this.schedule('enrichment-retry-queue', '0 */6 * * *', () => this.processEnrichmentRetryQueue(), DB_ADVISORY_LOCKS.ENRICHMENT_RETRY_QUEUE);

        // Daily rating normalization check at 3 AM
        this.schedule('rating-normalization-check', '0 3 * * *', () => this.runRatingNormalizationCheck(), DB_ADVISORY_LOCKS.RATING_NORMALIZATION_CHECK);

        // Daily cleanup of expired refresh tokens (3:05 AM)
        this.schedule('refresh-token-cleanup', '5 3 * * *', () => this.runRefreshTokenCleanup());

        // Daily pruning of old api_key_audit rows (3:10 AM)
        this.schedule('api-key-audit-prune', '10 3 * * *', () => this.runApiKeyAuditPrune());

        // Daily pruning of old error_log rows (3:12 AM)
        this.schedule('error-log-cleanup', '12 3 * * *', () => this.runErrorLogCleanup());

        // Daily redaction of expired native-intent rollback payloads (3:13 AM)
        this.schedule('policy-rollback-snapshot-retention-cleanup', '13 3 * * *', () => this.runPolicyRollbackSnapshotRetentionCleanup());

        // Daily cleanup of web-search provider cache and usage rows (3:14 AM)
        this.schedule('web-search-provider-retention-cleanup', '14 3 * * *', () => this.runWebSearchProviderRetentionCleanup());

        // Daily redaction of expired observed evidence provenance payloads (3:15 AM)
        this.schedule('policy-observed-evidence-provenance-retention-cleanup', '15 3 * * *', () => this.runPolicyObservedEvidenceProvenanceRetentionCleanup());

        // Daily pruning of bounded native-intent reconciliation ledger rows (3:16 AM)
        this.schedule('native-intent-reconciliation-ledger-retention-cleanup', '16 3 * * *', () => this.runNativeIntentReconciliationLedgerRetentionCleanup());

        // Daily pruning of expired native-intent change receipts. This is
        // intentionally scheduled only; receipt recovery does not require a
        // startup mutation.
        this.schedule('native-intent-change-receipt-retention-cleanup', '17 3 * * *', () => this.runPolicyNativeIntentChangeReceiptRetentionCleanup());

        // Daily deletion of expired, redacted representative-review projections.
        this.schedule('policy-candidate-correction-review-projection-retention-cleanup', '18 3 * * *', () => this.runPolicyCandidateCorrectionRepresentativeReviewProjectionRetentionCleanup());

        // Daily cleanup of stale awaiting_decision rows (4 AM)
        this.schedule('stale-awaiting-cleanup', '0 4 * * *', () => this.cleanupStaleAwaitingDecisions(), DB_ADVISORY_LOCKS.STALE_CLEANUP);

        // Daily cleanup of old completed/failed task_queue rows (3:15 AM).
        // QueueMaintenanceService owns the cross-process lock; noOverlap avoids
        // redundant in-process cron invocations before that service boundary.
        this.schedule(
            'task-queue-cleanup',
            '15 3 * * *',
            () => this.runTaskQueueCleanup({ cleanupOrigin: TASK_QUEUE_CLEANUP_ORIGINS.CRON }),
            null,
            { noOverlap: true },
        );

        // Run initial task_queue cleanup after startup (5 min delay)
        this.scheduleInitial(
            'task-queue-cleanup',
            300000,
            () => this.runTaskQueueCleanup({ cleanupOrigin: TASK_QUEUE_CLEANUP_ORIGINS.STARTUP_DELAYED }),
        );
    }

    /**
     * Sync all active libraries from media server
     */
    async runPeriodicLibrarySync() {
        return _runPeriodicLibrarySync();
    }

    /**
     * Check for items needing rating normalization and queue them
     */
    async runRatingNormalizationCheck() {
        return this.ratingNormalizationQueueService.queueDailyBackfill();
    }

    /**
     * Daily cleanup of expired and long-revoked refresh tokens.
     */
    async runRefreshTokenCleanup() {
        return schedulerRetentionService.runRefreshTokenCleanup();
    }

    /**
     * Daily pruning of old api_key_audit rows older than the configured retention window.
     */
    async runApiKeyAuditPrune() {
        return schedulerRetentionService.runApiKeyAuditPrune();
    }

    /**
     * Daily cleanup of old error_log rows using settings.error_log_retention_days.
     */
    async runErrorLogCleanup() {
        return schedulerRetentionService.runErrorLogCleanup();
    }

    /**
     * Daily cleanup of expired web-search provider cache entries and old usage rows.
     */
    async runWebSearchProviderRetentionCleanup() {
        return schedulerRetentionService.runWebSearchProviderRetentionCleanup();
    }

    /**
     * Daily redaction of expired rollback snapshot payloads while retaining a
     * bounded migration audit record.
     */
    async runPolicyRollbackSnapshotRetentionCleanup() {
        return schedulerRetentionService.runPolicyRollbackSnapshotRetentionCleanup();
    }

    /**
     * Daily redaction of expired observed library evidence retained only for
     * initial native-intent establishment provenance.
     */
    async runPolicyObservedEvidenceProvenanceRetentionCleanup() {
        return schedulerRetentionService.runPolicyObservedEvidenceProvenanceRetentionCleanup();
    }

    /**
     * Daily cleanup of bounded native-intent reconciliation support evidence.
     */
    async runNativeIntentReconciliationLedgerRetentionCleanup() {
        return schedulerRetentionService.runNativeIntentReconciliationLedgerRetentionCleanup();
    }

    /**
     * Daily pruning of expired, append-only native-intent change receipts.
     */
    async runPolicyNativeIntentChangeReceiptRetentionCleanup() {
        return schedulerRetentionService.runPolicyNativeIntentChangeReceiptRetentionCleanup();
    }

    /**
     * Daily deletion of expired redacted representative-review projections.
     */
    async runPolicyCandidateCorrectionRepresentativeReviewProjectionRetentionCleanup() {
        return schedulerRetentionService.runPolicyCandidateCorrectionRepresentativeReviewProjectionRetentionCleanup();
    }

    /**
     * Daily cleanup of old completed and failed task_queue rows.
     */
    async runTaskQueueCleanup({ cleanupOrigin = TASK_QUEUE_CLEANUP_ORIGINS.CRON } = {}) {
        return queueMaintenanceService.runScheduledTaskQueueCleanup({ cleanupOrigin });
    }

    /**
     * Daily cleanup of stale awaiting_decision classification rows.
     */
    async cleanupStaleAwaitingDecisions() {
        return classificationMaintenanceService.cleanupStaleAwaitingDecisions();
    }

    /**
     * @param {string} name - Task name
     * @param {string} cronExpression - Cron expression
     * @param {Function} handler - Task handler
     * @param {number|null} [lockKey=null] - Optional DB_ADVISORY_LOCKS key.
     */
    schedule(name, cronExpression, handler, lockKey = null, scheduleOptions = {}) {
        if (this.tasks.has(name)) {
            this.tasks.get(name).stop();
        }

        const scheduledHandler = async () => {
            await this.runScheduledTask(name, handler, lockKey);
        };
        const task = Object.keys(scheduleOptions).length > 0
            ? cron.schedule(cronExpression, scheduledHandler, scheduleOptions)
            : cron.schedule(cronExpression, scheduledHandler);

        this.tasks.set(name, task);
        logger.info(`Scheduled task registered: ${name} (${cronExpression})`);
    }

    async runScheduledTask(name, handler, lockKey = null) {
        logger.info(`Starting scheduled task: ${name}`);
        try {
            if (lockKey !== null) {
                const acquired = await withSessionAdvisoryLock(lockKey, handler);
                if (!acquired) {
                    logger.debug(`Scheduled task ${name} skipped — advisory lock held by another process`, { lockKey });
                    return false;
                }
            } else {
                await handler();
            }
            logger.info(`Completed scheduled task: ${name}`);
            return true;
        } catch (error) {
            logger.error(`Failed scheduled task: ${name}`, { error: error.message });
            return false;
        }
    }

    scheduleInitial(name, delayMs, handler, lockKey = null) {
        const existingTimer = this.initialTaskTimers.get(name);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.initialTaskTimers.delete(name);
            await this.runScheduledTask(name, handler, lockKey);
        }, delayMs);

        this.initialTaskTimers.set(name, timer);
    }

    startNativeIntentReconciliation() {
        if (this.tasks.has(NATIVE_INTENT_RECONCILIATION_TASK_NAME)) {
            return false;
        }

        const handler = () => this.runNativeIntentReconciliation();
        this.schedule(
            NATIVE_INTENT_RECONCILIATION_TASK_NAME,
            NATIVE_INTENT_RECONCILIATION_CRON,
            handler,
            DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION,
            { noOverlap: true },
        );
        this.scheduleInitial(
            NATIVE_INTENT_RECONCILIATION_TASK_NAME,
            NATIVE_INTENT_RECONCILIATION_INITIAL_DELAY_MS,
            handler,
            DB_ADVISORY_LOCKS.NATIVE_INTENT_RECONCILIATION,
        );

        logger.info('Native intent reconciliation scheduled after application readiness');
        return true;
    }

    async runNativeIntentReconciliation() {
        return nativeIntentReconciliationService.run();
    }

    startPolicyProfileRefreshOutboxWorker() {
        if (this.tasks.has(POLICY_PROFILE_REFRESH_OUTBOX_TASK_NAME)) {
            return false;
        }

        const handler = () => this.runPolicyProfileRefreshOutboxWorker();
        this.schedule(
            POLICY_PROFILE_REFRESH_OUTBOX_TASK_NAME,
            POLICY_PROFILE_REFRESH_OUTBOX_CRON,
            handler,
            DB_ADVISORY_LOCKS.POLICY_PROFILE_REFRESH_OUTBOX,
            { noOverlap: true },
        );
        this.scheduleInitial(
            POLICY_PROFILE_REFRESH_OUTBOX_TASK_NAME,
            POLICY_PROFILE_REFRESH_OUTBOX_INITIAL_DELAY_MS,
            handler,
            DB_ADVISORY_LOCKS.POLICY_PROFILE_REFRESH_OUTBOX,
        );

        logger.info('Policy profile refresh outbox worker scheduled after application readiness');
        return true;
    }

    async runPolicyProfileRefreshOutboxWorker() {
        return policyProfileRefreshAutomationService.run();
    }

    /**
     * Run Gap Analysis specifically
     */
    async runGapAnalysis() {
        return _runGapAnalysis();
    }

    /**
     * Check for empty libraries and trigger sync
     */
    async runLibraryWatchdog() {
        return _runLibraryWatchdog();
    }

    /**
     * Auto-learn rules for libraries with enough analyzed content
     */
    async runAutoLearnRules() {
        return _runAutoLearnRules();
    }

    /**
     * Process retry queue for classifications that failed due to AI unavailability
     */
    async processRetryQueue() {
        return _processRetryQueue();
    }

    /**
     * Process enrichment retry queue for OMDb/Tavily enrichment failures
     */
    async processEnrichmentRetryQueue() {
        return _processEnrichmentRetryQueue();
    }
}

export const schedulerService = new SchedulerService();
