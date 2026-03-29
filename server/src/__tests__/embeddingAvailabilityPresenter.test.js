/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const { presentEmbeddingAvailability } = require('../utils/embeddingAvailabilityPresenter');

describe('embeddingAvailabilityPresenter', () => {
    it('adds stable presentation and controls for cooldown state', () => {
        const presented = presentEmbeddingAvailability({
            status: 'cooldown',
            cooldownUntil: '2026-03-28T00:00:00.000Z',
            lastError: 'connect ETIMEDOUT 192.168.50.95:11434',
            failureCount: 4
        });

        expect(presented.retryAt).toBe('2026-03-28T00:00:00.000Z');
        expect(presented.presentation).toEqual({
            statusLabel: 'Cooling Down',
            flag: 'WAIT',
            headline: 'Embedding provider cooling down',
            detail: 'connect ETIMEDOUT 192.168.50.95:11434',
            tone: 'danger'
        });
        expect(presented.controls).toEqual({
            canRunJobs: false,
            canStartManualBackfill: false,
            canResumeManualBackfill: false,
            queuedWorkPaused: true
        });
    });

    it('uses stable defaults for available state', () => {
        const presented = presentEmbeddingAvailability({});

        expect(presented.status).toBe('available');
        expect(presented.presentation.statusLabel).toBe('Available');
        expect(presented.presentation.flag).toBe('ON');
        expect(presented.controls.canRunJobs).toBe(true);
        expect(presented.controls.queuedWorkPaused).toBe(false);
    });

    it('covers probing and probe_due states with default details', () => {
        const probing = presentEmbeddingAvailability({
            status: 'probing',
            retryAt: '2026-03-28T01:00:00.000Z'
        });
        const probeDue = presentEmbeddingAvailability({
            status: 'probe_due'
        });

        expect(probing.retryAt).toBe('2026-03-28T01:00:00.000Z');
        expect(probing.presentation).toEqual({
            statusLabel: 'Probing',
            flag: 'TEST',
            headline: 'Embedding provider recovery probe in progress',
            detail: 'Queued embedding work is paused until the provider passes a recovery probe.',
            tone: 'warning'
        });
        expect(probing.controls.canRunJobs).toBe(false);
        expect(probeDue.presentation.statusLabel).toBe('Probe Due');
        expect(probeDue.presentation.flag).toBe('HOLD');
        expect(probeDue.controls.queuedWorkPaused).toBe(true);
    });
});
