/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import EventEmitter from 'events';
import { createLogger } from './logger.mjs';
const logger = createLogger('IdleDetector');
class IdleDetector extends EventEmitter {
    constructor() {
        super();
        this.lastActivity = 0;
        this.idleThreshold = 30000;
        this.isCurrentlyIdle = false;
        this.checkInterval = null;
    }
    start() {
        if (this.checkInterval) {
            return;
        }
        logger.info('Starting idle detection', { thresholdMs: this.idleThreshold });
        this.checkInterval = setInterval(() => {
            this.checkIdleState();
        }, 5000);
    }
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Stopped idle detection');
        }
    }
    recordActivity() {
        const wasIdle = this.isCurrentlyIdle;
        this.lastActivity = Date.now();
        if (wasIdle) {
            this.isCurrentlyIdle = false;
            logger.info('Activity detected, system now active');
            this.emit('active');
        }
    }
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
    isIdle() {
        return this.isCurrentlyIdle;
    }
    setIdleThreshold(thresholdMs) {
        this.idleThreshold = thresholdMs;
        logger.info('Updated idle threshold', { thresholdMs });
    }
    getState() {
        return {
            isIdle: this.isCurrentlyIdle,
            lastActivity: this.lastActivity,
            timeSinceActivity: Date.now() - this.lastActivity,
            threshold: this.idleThreshold
        };
    }
}
const idleDetector = new IdleDetector();
export default idleDetector;
export { IdleDetector };
