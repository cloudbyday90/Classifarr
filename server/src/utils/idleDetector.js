/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const EventEmitter = require('events');
const { createLogger } = require('./logger');

const logger = createLogger('IdleDetector');

/**
 * IdleDetector
 * Monitors classification activity and emits idle/active events
 */
class IdleDetector extends EventEmitter {
    constructor() {
        super();
        // Initialize to far past so system can be idle immediately on start
        this.lastActivity = 0;
        this.idleThreshold = 30000; // 30 seconds default
        this.isCurrentlyIdle = false;
        this.checkInterval = null;
    }

    /**
     * Start monitoring for idle periods
     */
    start() {
        if (this.checkInterval) {
            return; // Already started
        }

        logger.info('Starting idle detection', { thresholdMs: this.idleThreshold });

        // Check every 5 seconds if we're idle
        this.checkInterval = setInterval(() => {
            this.checkIdleState();
        }, 5000);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Stopped idle detection');
        }
    }

    /**
     * Record classification activity
     */
    recordActivity() {
        const wasIdle = this.isCurrentlyIdle;
        this.lastActivity = Date.now();
        
        if (wasIdle) {
            this.isCurrentlyIdle = false;
            logger.info('Activity detected, system now active');
            this.emit('active');
        }
    }

    /**
     * Check if system is currently idle
     */
    checkIdleState() {
        const timeSinceActivity = Date.now() - this.lastActivity;
        const shouldBeIdle = timeSinceActivity >= this.idleThreshold;

        if (shouldBeIdle && !this.isCurrentlyIdle) {
            this.isCurrentlyIdle = true;
            logger.info('System is now idle', { 
                timeSinceActivityMs: timeSinceActivity,
                thresholdMs: this.idleThreshold 
            });
            this.emit('idle');
        } else if (!shouldBeIdle && this.isCurrentlyIdle) {
            this.isCurrentlyIdle = false;
            logger.info('System is now active');
            this.emit('active');
        }
    }

    /**
     * Check if currently idle (synchronous)
     */
    isIdle() {
        return this.isCurrentlyIdle;
    }

    /**
     * Update idle threshold
     */
    setIdleThreshold(thresholdMs) {
        this.idleThreshold = thresholdMs;
        logger.info('Updated idle threshold', { thresholdMs });
    }

    /**
     * Get current state
     */
    getState() {
        return {
            isIdle: this.isCurrentlyIdle,
            lastActivity: this.lastActivity,
            timeSinceActivity: Date.now() - this.lastActivity,
            threshold: this.idleThreshold
        };
    }
}

// Export singleton instance
module.exports = new IdleDetector();
