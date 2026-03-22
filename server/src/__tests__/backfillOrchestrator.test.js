/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

jest.mock('../services/idleBackfillService', () => ({
    setManualBackfillService: jest.fn(),
    startIdleBackfill: jest.fn().mockResolvedValue(),
    stopIdleBackfill: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ isRunning: false })
}));

jest.mock('../services/scheduledBackfillService', () => ({
    initScheduler: jest.fn().mockResolvedValue(),
    stop: jest.fn(),
    getSchedule: jest.fn().mockReturnValue({ enabled: true })
}));

jest.mock('../services/manualBackfillService', () => ({
    getStatus: jest.fn()
}));

jest.mock('../utils/idleDetector', () => ({
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    getState: jest.fn().mockReturnValue({ isIdle: false })
}));

jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const idleBackfillService = require('../services/idleBackfillService');
const scheduledBackfillService = require('../services/scheduledBackfillService');
const manualBackfillService = require('../services/manualBackfillService');
const idleDetector = require('../utils/idleDetector');
const backfillOrchestrator = require('../services/backfillOrchestrator');

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
