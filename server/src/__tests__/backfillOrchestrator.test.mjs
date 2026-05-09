/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

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
    getState: jest.fn().mockReturnValue({ isIdle: false })
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
        jest.clearAllMocks();
        backfillOrchestrator.initialized = false;
        backfillOrchestrator.idleListener = null;
        backfillOrchestrator.activeListener = null;
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
});
