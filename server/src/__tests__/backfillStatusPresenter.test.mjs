/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
    presentManualBackfillStatus,
    presentIdleBackfillStatus,
    presentScheduledBackfillStatus
} from '../utils/backfillStatusPresenter.mjs';

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

    it('covers the remaining manual presentation states', () => {
        const running = presentManualBackfillStatus({
            status: 'running',
            processed: 3,
            total: 9
        });
        const cancelling = presentManualBackfillStatus({
            status: 'cancelling'
        });
        const completed = presentManualBackfillStatus({
            status: 'completed',
            processed: 17
        });
        const failed = presentManualBackfillStatus({
            status: 'failed',
            error: 'provider timeout'
        });
        const idle = presentManualBackfillStatus({});

        expect(running.presentation).toEqual({
            statusLabel: 'Running',
            headline: 'Manual backfill running',
            detail: '3 of 9 items processed.',
            tone: 'info'
        });
        expect(cancelling.presentation.statusLabel).toBe('Cancelling');
        expect(completed.isTerminal).toBe(true);
        expect(completed.presentation.detail).toBe('17 items processed.');
        expect(failed.presentation.tone).toBe('danger');
        expect(idle.controls.canStart).toBe(true);
        expect(idle.presentation.statusLabel).toBe('Idle');
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

    it('covers idle running and disabled states', () => {
        const running = presentIdleBackfillStatus({
            status: 'enabled',
            enabled: true,
            isRunning: true
        });
        const disabled = presentIdleBackfillStatus({
            enabled: false,
            isRunning: false
        });

        expect(running.status).toBe('running');
        expect(running.presentation.statusLabel).toBe('Running');
        expect(running.controls.canRun).toBe(true);
        expect(disabled.status).toBe('disabled');
        expect(disabled.presentation.statusLabel).toBe('Disabled');
        expect(disabled.controls.canRun).toBe(false);
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

    it('covers scheduled cooldown and running states', () => {
        const cooldown = presentScheduledBackfillStatus(
            {
                enabled: true,
                isRunning: false
            },
            {
                status: 'probe_due',
                presentation: {
                    detail: 'probe pending'
                }
            }
        );
        const running = presentScheduledBackfillStatus({
            enabled: true,
            isRunning: true
        });

        expect(cooldown.status).toBe('cooldown');
        expect(cooldown.isPaused).toBe(true);
        expect(cooldown.presentation.statusLabel).toBe('Waiting');
        expect(cooldown.presentation.detail).toBe('probe pending');
        expect(running.status).toBe('running');
        expect(running.presentation.statusLabel).toBe('Running');
    });
});
