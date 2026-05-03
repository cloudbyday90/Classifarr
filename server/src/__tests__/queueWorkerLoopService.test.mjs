/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import { QueueWorkerLoopService } from '../services/queueWorkerLoopService.mjs';

describe('QueueWorkerLoopService', () => {
    let service;
    let state;
    let deps;

    beforeEach(() => {
        state = {
            running: false,
            processing: 0,
            lastRecoveryCheck: 0,
            fullConcurrencyStartedAt: 0,
            aiAvailable: true,
            lastAiAvailabilityProbeAt: 0,
        };

        deps = {
            db: { query: jest.fn() },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            getState: () => ({ ...state }),
            setRunning: jest.fn((running) => {
                state.running = running;
            }),
            incrementProcessing: jest.fn(() => {
                state.processing += 1;
            }),
            decrementProcessing: jest.fn(() => {
                state.processing -= 1;
            }),
            setLastRecoveryCheck: jest.fn((value) => {
                state.lastRecoveryCheck = value;
            }),
            setFullConcurrencyStartedAt: jest.fn((value) => {
                state.fullConcurrencyStartedAt = value;
            }),
            setLastAiAvailabilityProbeAt: jest.fn((value) => {
                state.lastAiAvailabilityProbeAt = value;
            }),
            resetStaleProcessingTasks: jest.fn().mockResolvedValue(0),
            backgroundDrainIfBloated: jest.fn().mockResolvedValue(undefined),
            hasClassificationDispatchBlocker: jest.fn().mockResolvedValue({
                hasProcessingClassification: false,
                lookupFailed: false,
            }),
            dequeue: jest.fn().mockResolvedValue(null),
            checkAIAvailability: jest.fn().mockResolvedValue(true),
            processTask: jest.fn().mockResolvedValue(undefined),
            recoverExpiredVisibilityTasks: jest.fn().mockResolvedValue(0),
            wait: jest.fn().mockResolvedValue(undefined),
            yieldToEventLoop: jest.fn().mockResolvedValue(undefined),
            pollIntervalMs: 1000,
            maxConcurrent: 5,
            visibilityRecoveryIntervalMs: 60000,
            stallWarnIntervalMs: 30000,
            aiAvailabilityProbeIntervalMs: 30000,
        };

        service = new QueueWorkerLoopService(deps);
    });

    it('excludes classification from dequeue while AI is unavailable and the next probe is not due', async () => {
        state.aiAvailable = false;
        state.lastAiAvailabilityProbeAt = Date.now();

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(false);
        expect(deps.checkAIAvailability).not.toHaveBeenCalled();
        expect(deps.dequeue).toHaveBeenCalledWith({ excludeClassification: true });
        expect(deps.db.query).not.toHaveBeenCalled();
    });

    it('probes AI availability before dequeueing classification after the cooldown window', async () => {
        state.aiAvailable = false;
        state.lastAiAvailabilityProbeAt = Date.now() - 31_000;
        deps.checkAIAvailability.mockResolvedValueOnce(true);
        deps.dequeue.mockResolvedValueOnce({
            id: 42,
            task_type: 'classification',
        });

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.setLastAiAvailabilityProbeAt).toHaveBeenCalled();
        expect(deps.checkAIAvailability).toHaveBeenCalledTimes(1);
        expect(deps.dequeue).toHaveBeenCalledWith({ excludeClassification: false });
        expect(deps.processTask).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
        expect(deps.db.query).not.toHaveBeenCalled();
    });

    it('falls back to requeueing if AI goes unavailable after classification is dequeued', async () => {
        deps.dequeue.mockResolvedValueOnce({
            id: 99,
            task_type: 'classification',
        });
        deps.checkAIAvailability.mockResolvedValueOnce(false);

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.db.query).toHaveBeenCalledWith(
            "UPDATE task_queue SET status = 'pending', started_at = NULL, visible_at = NULL WHERE id = $1",
            [99]
        );
        expect(deps.wait).toHaveBeenCalledWith(1000);
        expect(deps.processTask).not.toHaveBeenCalled();
    });
});
