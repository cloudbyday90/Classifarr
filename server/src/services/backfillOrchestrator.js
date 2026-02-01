/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const idleBackfillService = require('./idleBackfillService');
const scheduledBackfillService = require('./scheduledBackfillService');
const manualBackfillService = require('./manualBackfillService');
const idleDetector = require('../utils/idleDetector');
const { createLogger } = require('../utils/logger');

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
        this.idleBackfillService = idleBackfillService;
        this.scheduledBackfillService = scheduledBackfillService;
        this.manualBackfillService = manualBackfillService;
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

        // Start idle detector
        idleDetector.start();

        // Initialize scheduled backfill
        await this.scheduledBackfillService.initScheduler();

        // Remove old listeners if they exist
        if (this.idleListener) {
            idleDetector.removeListener('idle', this.idleListener);
        }
        if (this.activeListener) {
            idleDetector.removeListener('active', this.activeListener);
        }

        // Create and store new listeners
        this.idleListener = () => {
            // Only start idle backfill if manual backfill is not running
            if (this.manualBackfillService.getStatus().status !== 'running') {
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

        this.initialized = true;
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

module.exports = new BackfillOrchestrator();
