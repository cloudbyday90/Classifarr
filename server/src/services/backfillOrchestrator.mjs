/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { idleBackfillService } from './idleBackfillService.mjs';
import { scheduledBackfillService } from './scheduledBackfillService.mjs';
import { manualBackfillService } from './manualBackfillService.mjs';
import { idleDetector } from '../utils/idleDetector.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('BackfillOrchestrator');

/**
 * BackfillOrchestrator
 * Coordinates all backfill modes (real-time, idle, scheduled, manual)
 */
class BackfillOrchestrator {
    constructor() {
        this.initialized = false;
        this.idleListener = null;    // Store reference for cleanup
        this.activeListener = null;  // Store reference for cleanup
        this.recoveryTimer = null;
        this.idleBackfillService = idleBackfillService;
        this.scheduledBackfillService = scheduledBackfillService;
        this.manualBackfillService = manualBackfillService;
    }

    isDetectorEffectivelyIdle(detector = idleDetector) {
        if (typeof detector?.isIdle === 'function' && detector.isIdle()) {
            return true;
        }

        const state = typeof detector?.getState === 'function' ? detector.getState() : null;
        const timeSinceActivity = Number(state?.timeSinceActivity);
        const threshold = Number(state?.threshold);

        return Number.isFinite(timeSinceActivity)
            && Number.isFinite(threshold)
            && timeSinceActivity >= threshold;
    }

    async maybeStartIdleBackfill(reason = 'unspecified') {
        try {
            const manualStatus = await this.manualBackfillService.getStatus();
            if (['running', 'cancelling'].includes(manualStatus.status)) {
                logger.info('Idle backfill NOT started: manual backfill is active', {
                    reason,
                    manualStatus: manualStatus.status,
                });
                return false;
            }

            logger.info('Attempting idle backfill reconciliation', { reason });
            await this.idleBackfillService.startIdleBackfill();
            return true;
        } catch (error) {
            logger.error('Idle backfill reconciliation failed', {
                reason,
                error: error.message,
            });
            return false;
        }
    }

    startRecoveryWatchdog() {
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = null;
        }

        this.recoveryTimer = setInterval(() => {
            if (!this.isDetectorEffectivelyIdle()) {
                return;
            }

            void this.maybeStartIdleBackfill('idle_watchdog');
        }, 60_000);

        if (typeof this.recoveryTimer?.unref === 'function') {
            this.recoveryTimer.unref();
        }
    }

    /**
     * Initialize backfill orchestrator
     */
    async init() {
        if (this.initialized) {
            return;
        }

        logger.info('Initializing backfill orchestrator');

        // Set cross-references for status checking
        this.idleBackfillService.setManualBackfillService(this.manualBackfillService);

        // Remove old listeners if they exist
        if (this.idleListener) {
            idleDetector.removeListener('idle', this.idleListener);
        }
        if (this.activeListener) {
            idleDetector.removeListener('active', this.activeListener);
        }

        // Create and store new listeners
        this.idleListener = async () => {
            // Only start idle backfill if manual backfill is not running
            const manualStatus = await this.manualBackfillService.getStatus();
            if (!['running', 'cancelling'].includes(manualStatus.status)) {
                logger.info('System idle, starting idle backfill');
                this.idleBackfillService.startIdleBackfill().catch(error => {
                    logger.error('Idle backfill error', { error: error.message });
                });
            }
        };

        this.activeListener = () => {
            logger.info('System active, stopping idle backfill');
            this.idleBackfillService.stopIdleBackfill();
        };

        // Attach listeners
        idleDetector.on('idle', this.idleListener);
        idleDetector.on('active', this.activeListener);

        // Start idle detector
        idleDetector.start();

        // Initialize scheduled backfill
        await this.scheduledBackfillService.initScheduler();

        this.initialized = true;
        this.startRecoveryWatchdog();

        if (this.isDetectorEffectivelyIdle()) {
            await this.maybeStartIdleBackfill('startup_reconcile');
        }

        logger.info('Backfill orchestrator initialized');
    }

    /**
     * Shutdown orchestrator
     */
    shutdown() {
        logger.info('Shutting down backfill orchestrator');

        // Clean up listeners
        if (this.idleListener) {
            idleDetector.removeListener('idle', this.idleListener);
            this.idleListener = null;
        }
        if (this.activeListener) {
            idleDetector.removeListener('active', this.activeListener);
            this.activeListener = null;
        }
        if (this.recoveryTimer) {
            clearInterval(this.recoveryTimer);
            this.recoveryTimer = null;
        }

        idleDetector.stop();

        this.idleBackfillService.stopIdleBackfill();
        this.scheduledBackfillService.stop();

        this.initialized = false;
    }

    /**
     * Get overall status
     */
    getStatus() {
        return {
            idle: this.idleBackfillService.getStatus(),
            scheduled: this.scheduledBackfillService.getSchedule(),
            manual: this.manualBackfillService.getStatus(),
            idleDetector: idleDetector.getState()
        };
    }
}

export const backfillOrchestrator = new BackfillOrchestrator();
