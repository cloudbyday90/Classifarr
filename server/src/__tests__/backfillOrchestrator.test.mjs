/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { afterEach, jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const idleBackfillService = {
    setManualBackfillService: jest.fn(),
    startIdleBackfill: jest.fn().mockResolvedValue(),
    stopIdleBackfill: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ isRunning: false })
};

const scheduledBackfillService = {
    initScheduler: jest.fn().mockResolvedValue(),
    stop: jest.fn(),
    getSchedule: jest.fn().mockReturnValue({ enabled: true })
};

const manualBackfillService = {
    getStatus: jest.fn()
};

const idleDetector = {
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    isIdle: jest.fn().mockReturnValue(false),
    getState: jest.fn().mockReturnValue({
        isIdle: false,
        timeSinceActivity: 0,
        threshold: 30000,
    }),
};

await jest.unstable_mockModule('../services/idleBackfillService.mjs', () => ({ idleBackfillService }));

await jest.unstable_mockModule('../services/scheduledBackfillService.mjs', () => ({ scheduledBackfillService }));

await jest.unstable_mockModule('../services/manualBackfillService.mjs', () => ({ manualBackfillService }));

await jest.unstable_mockModule('../utils/idleDetector.mjs', () => ({
        idleDetector
}));

await jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { backfillOrchestrator } = await import('../services/backfillOrchestrator.mjs');

describe('BackfillOrchestrator', () => {
    beforeEach(() => {
        idleBackfillService.setManualBackfillService.mockReset();
        idleBackfillService.startIdleBackfill.mockReset();
        idleBackfillService.stopIdleBackfill.mockReset();
        idleBackfillService.getStatus.mockReset();
        scheduledBackfillService.initScheduler.mockReset();
        scheduledBackfillService.stop.mockReset();
        scheduledBackfillService.getSchedule.mockReset();
        manualBackfillService.getStatus.mockReset();
        idleDetector.start.mockReset();
        idleDetector.stop.mockReset();
        idleDetector.on.mockReset();
        idleDetector.removeListener.mockReset();
        idleDetector.isIdle.mockReset();
        idleDetector.getState.mockReset();
        backfillOrchestrator.initialized = false;
        backfillOrchestrator.idleListener = null;
        backfillOrchestrator.activeListener = null;
        backfillOrchestrator.recoveryTimer = null;
        idleBackfillService.startIdleBackfill.mockResolvedValue();
        idleBackfillService.getStatus.mockReturnValue({ isRunning: false });
        scheduledBackfillService.initScheduler.mockResolvedValue();
        scheduledBackfillService.getSchedule.mockReturnValue({ enabled: true });
        idleDetector.isIdle.mockReturnValue(false);
        idleDetector.getState.mockReturnValue({
            isIdle: false,
            timeSinceActivity: 0,
            threshold: 30000,
        });
    });

    afterEach(() => {
        backfillOrchestrator.shutdown();
    });

    it('does not start idle backfill while manual backfill is running', async () => {
        manualBackfillService.getStatus.mockResolvedValue({ status: 'running' });

        await backfillOrchestrator.init();

        const idleHandler = idleDetector.on.mock.calls.find(([event]) => event === 'idle')[1];
        await idleHandler();

        expect(idleBackfillService.startIdleBackfill).not.toHaveBeenCalled();
    });

    it('starts idle backfill when manual backfill is not active', async () => {
        manualBackfillService.getStatus.mockResolvedValue({ status: 'idle' });

        await backfillOrchestrator.init();

        const idleHandler = idleDetector.on.mock.calls.find(([event]) => event === 'idle')[1];
        await idleHandler();

        expect(idleBackfillService.startIdleBackfill).toHaveBeenCalled();
        expect(scheduledBackfillService.initScheduler).toHaveBeenCalled();
    });

    it('starts idle backfill during init when the system is already idle and manual backfill is inactive', async () => {
        manualBackfillService.getStatus.mockResolvedValue({ status: 'idle' });
        idleDetector.getState.mockReturnValue({
            isIdle: false,
            timeSinceActivity: 30005,
            threshold: 30000,
        });

        await backfillOrchestrator.init();

        expect(idleBackfillService.startIdleBackfill).toHaveBeenCalledTimes(1);
        expect(idleDetector.start).toHaveBeenCalled();
    });

    it('does not start idle backfill during init when manual backfill is already running', async () => {
        manualBackfillService.getStatus.mockResolvedValue({ status: 'running' });
        idleDetector.getState.mockReturnValue({
            isIdle: false,
            timeSinceActivity: 30005,
            threshold: 30000,
        });

        await backfillOrchestrator.init();

        expect(idleBackfillService.startIdleBackfill).not.toHaveBeenCalled();
    });
});
