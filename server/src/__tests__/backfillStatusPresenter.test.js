/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const {
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
} = require('../utils/backfillStatusPresenter');

describe('backfillStatusPresenter', () => {
    it('adds presentation and controls for manual status', () => {
        const presented = presentManualBackfillStatus({
            status: 'paused',
            processed: 10,
            total: 100,
            error: 'Embedding provider unavailable until recovery probe succeeds'
        });

        expect(presented.mode).toBe('manual');
        expect(presented.controls.canResume).toBe(true);
        expect(presented.controls.canPause).toBe(false);
        expect(presented.presentation.statusLabel).toBe('Paused');
        expect(presented.presentation.detail).toContain('Embedding provider unavailable');
    });

    it('marks idle backfill as waiting while provider recovery is pending', () => {
        const presented = presentIdleBackfillStatus(
            {
                status: 'enabled',
                enabled: true,
                isRunning: false
            },
            {
                status: 'cooldown',
                presentation: {
                    detail: 'connect ETIMEDOUT 192.168.50.95:11434'
                }
            }
        );

        expect(presented.status).toBe('cooldown');
        expect(presented.isPaused).toBe(true);
        expect(presented.presentation.statusLabel).toBe('Waiting');
        expect(presented.presentation.detail).toContain('ETIMEDOUT');
    });

    it('keeps scheduled status enabled when provider is available', () => {
        const presented = presentScheduledBackfillStatus(
            {
                enabled: true,
                time: '02:00',
                isRunning: false
            },
            {
                status: 'available'
            }
        );

        expect(presented.status).toBe('enabled');
        expect(presented.controls.canRun).toBe(true);
        expect(presented.presentation.detail).toContain('02:00');
    });
});
