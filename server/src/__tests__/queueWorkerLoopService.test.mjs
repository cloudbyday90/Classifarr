/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import { QueueWorkerLoopService } from '../services/queueWorkerLoopService.mjs';
import { resourceAdmissionFixture } from './helpers/resourceAdmissionFixture.mjs';

describe('QueueWorkerLoopService', () => {
    let service;
    let state;
    let deps;

    beforeEach(() => {
        state = {
            running: false,
            processing: 0,
            processingByType: {},
            lastRecoveryCheck: 0,
            fullConcurrencyStartedAt: 0,
            aiAvailable: true,
            lastAiAvailabilityProbeAt: 0,
        };

        deps = {
            resourceAdmission: resourceAdmissionFixture(),
            db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
            logger: {
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            aiRouterService: {
                checkAvailability: jest.fn().mockResolvedValue(true),
            },
            ollamaService: {
                getGenerationStatus: jest.fn(),
            },
            getState: () => ({ ...state }),
            setRunning: jest.fn((running) => {
                state.running = running;
            }),
            incrementProcessing: jest.fn((taskType) => {
                state.processing += 1;
                state.processingByType[taskType] = (state.processingByType[taskType] || 0) + 1;
            }),
            decrementProcessing: jest.fn((taskType) => {
                state.processing -= 1;
                state.processingByType[taskType] = Math.max(0, (state.processingByType[taskType] || 0) - 1);
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
            setAiAvailable: jest.fn((value) => {
                state.aiAvailable = value;
            }),
            backgroundDrainIfBloated: jest.fn().mockResolvedValue(undefined),
            hasClassificationDispatchBlocker: jest.fn().mockResolvedValue({
                hasProcessingClassification: false,
                lookupFailed: false,
            }),
            getConcurrencySettings: jest.fn().mockResolvedValue({
                generalWorkers: 1,
                metadataEnrichmentWorkers: 5,
            }),
            dequeue: jest.fn().mockResolvedValue(null),
            processTask: jest.fn().mockResolvedValue(undefined),
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

    it('continues releasing tracked claims when one shutdown write fails', async () => {
        const first = { id: 1, claim_token: '11111111-1111-4111-8111-111111111111' };
        const second = { id: 2, claim_token: '22222222-2222-4222-8222-222222222222' };
        service.activeClaims.add(first);
        service.activeClaims.add(second);
        deps.db.query.mockRejectedValueOnce(new Error('connection interrupted'))
            .mockResolvedValueOnce({ rows: [{ id: 2 }] });
        await service.gracefulShutdown();
        expect(deps.db.query).toHaveBeenCalledTimes(2);
        expect(deps.logger.info).toHaveBeenCalledWith('Graceful shutdown: reset in-flight tasks to pending',
            { count: 1, taskIds: [2] });
        expect(deps.logger.error).toHaveBeenCalledTimes(1);
        expect(service.stopRequested).toBe(true);
    });

    it('waits before dequeue under pressure and automatically resumes after recovery', async () => {
        let available = 1;
        deps.resourceAdmission = resourceAdmissionFixture(() => ({ available, constrained: 2e9, total: 16e9 }));
        service = new QueueWorkerLoopService(deps);
        expect(await service.maybeDispatchTask()).toBe(false);
        expect(service.resourceWaitReason).toBe('memory_pressure');
        expect(deps.dequeue).not.toHaveBeenCalled();
        expect(deps.hasClassificationDispatchBlocker).not.toHaveBeenCalled();
        available = 1e9;
        expect(await service.maybeDispatchTask()).toBe(false);
        expect(service.resourceWaitReason).toBeNull();
        expect(deps.dequeue).toHaveBeenCalledTimes(1);
    });

    it.each(['empty', 'dequeue error', 'AI requeue', 'task rejection', 'synchronous throw'])('releases reservations after %s', async mode => {
        const release = jest.fn();
        service.resourceAdmission = { tryAcquire: () => ({ allowed: true, release }) };
        if (mode !== 'empty') deps.dequeue.mockResolvedValue({ id: 42, task_type: 'classification' });
        if (mode === 'dequeue error') deps.dequeue.mockRejectedValue(new Error('PRIVATE'));
        if (mode === 'AI requeue') deps.aiRouterService.checkAvailability.mockResolvedValue(false);
        if (mode === 'task rejection') deps.processTask.mockRejectedValue(new Error('PRIVATE'));
        if (mode === 'synchronous throw') deps.processTask.mockImplementation(() => { throw new Error('PRIVATE'); });
        if (mode === 'dequeue error') await expect(service.maybeDispatchTask()).rejects.toThrow('PRIVATE');
        else await service.maybeDispatchTask();
        await new Promise(resolve => { setImmediate(resolve); });
        expect(release).toHaveBeenCalledTimes(1);
        expect(state.processing).toBe(0);
        expect(JSON.stringify(deps.logger.error.mock.calls)).not.toContain('PRIVATE');
    });

    it('holds a task reservation until the actual task settles, without stopping visibility recovery', async () => {
        let finish;
        const release = jest.fn();
        service.resourceAdmission = { tryAcquire: () => ({ allowed: true, release }) };
        deps.dequeue.mockResolvedValue({ id: 42, task_type: 'metadata_enrichment' });
        deps.processTask.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        expect(await service.maybeDispatchTask()).toBe(true);
        expect(release).not.toHaveBeenCalled();
        service.resourceAdmission = { tryAcquire: () => ({ allowed: false, reason: 'memory_unknown' }) };
        expect(await service.maybeDispatchTask()).toBe(false);
        expect(state.processing).toBe(1);
        const recovery = jest.spyOn(service, 'recoverExpiredVisibilityTasks').mockResolvedValue(0);
        service.maybeRunVisibilityRecovery(60_001);
        expect(recovery).toHaveBeenCalledTimes(1);
        finish();
        await new Promise(resolve => { setImmediate(resolve); });
        expect(release).toHaveBeenCalledTimes(1);
        expect(state.processing).toBe(0);
    });

    it('excludes classification from dequeue while AI is unavailable and the next probe is not due', async () => {
        state.aiAvailable = false;
        state.lastAiAvailabilityProbeAt = Date.now();

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(false);
        expect(deps.aiRouterService.checkAvailability).not.toHaveBeenCalled();
        expect(deps.dequeue).toHaveBeenCalledWith({ excludeClassification: true });
        expect(deps.db.query).not.toHaveBeenCalled();
    });

    it('probes AI availability before dequeueing classification after the cooldown window', async () => {
        state.aiAvailable = false;
        state.lastAiAvailabilityProbeAt = Date.now() - 31_000;
        deps.aiRouterService.checkAvailability.mockResolvedValueOnce(true);
        deps.dequeue.mockResolvedValueOnce({
            id: 42,
            task_type: 'classification',
        });

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.setLastAiAvailabilityProbeAt).toHaveBeenCalled();
        expect(deps.aiRouterService.checkAvailability).toHaveBeenCalledTimes(1);
        expect(deps.setAiAvailable).toHaveBeenCalledWith(true);
        expect(deps.dequeue).toHaveBeenCalledWith({ excludeClassification: false });
        expect(deps.processTask).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }));
        expect(deps.db.query).not.toHaveBeenCalled();
    });

    it('falls back to requeueing if AI goes unavailable after classification is dequeued', async () => {
        deps.dequeue.mockResolvedValueOnce({
            id: 99,
            claim_token: '11111111-1111-4111-8111-111111111111',
            task_type: 'classification',
        });
        deps.aiRouterService.checkAvailability.mockResolvedValueOnce(false);

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.db.query).toHaveBeenCalledWith(
            expect.stringContaining('claim_token = $2::uuid'),
            [99, '11111111-1111-4111-8111-111111111111', null]
        );
        expect(deps.wait).toHaveBeenCalledWith(1000, { signal: expect.any(AbortSignal) });
        expect(deps.processTask).not.toHaveBeenCalled();
    });

    it('dequeues only metadata enrichment when general slots are full but metadata slots remain', async () => {
        state.processing = 1;
        state.processingByType = { classification: 1 };
        deps.dequeue.mockResolvedValueOnce({
            id: 7,
            task_type: 'metadata_enrichment',
        });

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.dequeue).toHaveBeenCalledWith({
            excludeClassification: false,
            onlyTaskTypes: ['metadata_enrichment'],
        });
        expect(deps.incrementProcessing).toHaveBeenCalledWith('metadata_enrichment');
    });

    it('excludes metadata enrichment when metadata slots are full but general slots remain', async () => {
        state.processing = 5;
        state.processingByType = { metadata_enrichment: 5 };
        deps.getConcurrencySettings.mockResolvedValueOnce({
            generalWorkers: 2,
            metadataEnrichmentWorkers: 5,
        });
        deps.dequeue.mockResolvedValueOnce({
            id: 8,
            task_type: 'classification',
        });

        const dispatched = await service.maybeDispatchTask();

        expect(dispatched).toBe(true);
        expect(deps.dequeue).toHaveBeenCalledWith({
            excludeClassification: false,
            excludeTaskTypes: ['metadata_enrichment'],
        });
        expect(deps.incrementProcessing).toHaveBeenCalledWith('classification');
    });

    it('retains one execution slot and permit until an expired live worker actually settles', async () => {
        const task = { id: 1, task_type: 'metadata_enrichment', claim_token: '11111111-1111-4111-8111-111111111111' };
        let finish;
        const work = new Promise(resolve => { finish = resolve; });
        const release = jest.fn();
        service.resourceAdmission = { tryAcquire: () => ({ allowed: true, release }) };
        deps.dequeue.mockResolvedValueOnce(task);
        deps.processTask.mockReturnValueOnce(work);
        await service.maybeDispatchTask();
        expect(service.activeClaims.has(task)).toBe(true);
        expect(state.processing).toBe(1);
        deps.db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1, task_type: 'metadata_enrichment' }] });
        await service.recoverExpiredVisibilityTasks();
        expect(state.processing).toBe(1);
        expect(release).not.toHaveBeenCalled();
        finish();
        await new Promise(resolve => { setImmediate(resolve); });
        expect(state.processing).toBe(0);
        expect(deps.decrementProcessing).toHaveBeenCalledTimes(1);
        expect(release).toHaveBeenCalledTimes(1);
        expect(service.activeClaims.size).toBe(0);
    });

    describe('worker wakeup lifecycle', () => {
        const turn = () => new Promise(resolve => { setImmediate(resolve); });
        const deferred = () => {
            let resolve;
            const promise = new Promise(done => { resolve = done; });
            return { promise, resolve };
        };

        beforeEach(() => {
            service = new QueueWorkerLoopService({ ...deps, wait: undefined, pollIntervalMs: 60_000 });
            jest.spyOn(service, 'resetStaleProcessingTasks').mockResolvedValue(0);
            jest.spyOn(service, 'recoverExpiredVisibilityTasks').mockResolvedValue(0);
        });

        afterEach(async () => {
            service.stopWorker();
            await service.workerPromise;
        });

        it('wakes on settlement after releasing counters and permit, without waiting for polling', async () => {
            const first = deferred();
            deps.getConcurrencySettings.mockResolvedValue({ generalWorkers: 1, metadataEnrichmentWorkers: 1 });
            const tasks = [1, 2].map(id => ({ id, task_type: 'metadata_enrichment' }));
            deps.dequeue.mockImplementation(async selection => selection.excludeTaskTypes ? null : tasks.shift());
            deps.processTask.mockImplementationOnce(() => first.promise);
            let permits = 0;
            service.resourceAdmission = { tryAcquire: () => {
                if (permits) return { allowed: false, reason: 'busy' };
                permits++;
                return { allowed: true, release: () => { permits--; } };
            } };
            // Normal slot exhaustion must remain interruptible, unlike pressure refusal.
            state.processing = 1;
            state.processingByType.classification = 1;
            const worker = service.startWorker();
            await turn();
            expect(deps.processTask).toHaveBeenCalledTimes(1);
            expect(permits).toBe(1);
            first.resolve();
            await turn();
            expect(deps.processTask).toHaveBeenCalledTimes(2);
            expect(permits).toBe(0);
            service.stopWorker();
            await worker;
        });

        it('retains notification during an empty asynchronous dequeue', async () => {
            const lookup = deferred();
            deps.dequeue.mockImplementationOnce(() => lookup.promise);
            service.startWorker();
            await turn();
            service.notifyWorkAvailable();
            lookup.resolve(null);
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(2);
        });

        it('wakes an idle loop for enqueue and otherwise stays asleep', async () => {
            service.startWorker();
            await turn();
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(1);
            for (let i = 0; i < 1000; i++) service.notifyWorkAvailable();
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(2);
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(2);
        });

        it('rechecks resource capacity on completion hints without bypassing admission', async () => {
            let busy = true;
            service.resourceAdmission = { tryAcquire: jest.fn(() => busy
                ? { allowed: false, reason: 'busy' }
                : { allowed: true, release: jest.fn() }) };
            service.startWorker();
            await turn();
            expect(deps.dequeue).not.toHaveBeenCalled();
            busy = false;
            service.notifyWorkAvailable();
            await turn();
            expect(service.resourceAdmission.tryAcquire).toHaveBeenCalledTimes(2);
            expect(deps.dequeue).toHaveBeenCalledTimes(1);
        });

        it('holds existing task counts across stop/start until actual settlement', async () => {
            const task = deferred();
            deps.getConcurrencySettings.mockResolvedValue({ generalWorkers: 1, metadataEnrichmentWorkers: 1 });
            deps.dequeue.mockResolvedValueOnce({ id: 42, task_type: 'metadata_enrichment' });
            deps.processTask.mockImplementationOnce(() => task.promise);
            const worker = service.startWorker();
            await turn();
            service.stopWorker();
            await worker;
            expect(state.processingByType.metadata_enrichment).toBe(1);
            deps.dequeue.mockClear();
            const restart = service.startWorker();
            await turn();
            expect(deps.dequeue).toHaveBeenCalledWith(expect.objectContaining({ excludeTaskTypes: ['metadata_enrichment'] }));
            task.resolve();
            await turn();
            expect(state.processingByType.metadata_enrichment).toBe(0);
            service.stopWorker();
            await restart;
        });

        it.each(['memory_pressure', 'memory_unknown', 'dispatch_error'])('does not bypass %s cooldown', async reason => {
            if (reason === 'dispatch_error') deps.dequeue.mockRejectedValue(new Error('PRIVATE'));
            else service.resourceAdmission = { tryAcquire: jest.fn(() => ({ allowed: false, reason })) };
            const attempt = jest.spyOn(service, 'maybeDispatchTask');
            service.startWorker();
            await turn();
            for (let i = 0; i < 1000; i++) service.notifyWorkAvailable();
            await turn();
            expect(attempt).toHaveBeenCalledTimes(1);
            expect(JSON.stringify(deps.logger.error.mock.calls)).not.toContain('PRIVATE');
        });

        it('polls when no hint arrives, allowing external inserts and due retries to be reconsidered', async () => {
            const sleep = deferred();
            service = new QueueWorkerLoopService({ ...deps, wait: jest.fn().mockImplementationOnce(() => sleep.promise) });
            jest.spyOn(service, 'resetStaleProcessingTasks').mockResolvedValue(0);
            jest.spyOn(service, 'recoverExpiredVisibilityTasks').mockResolvedValue(0);
            deps.dequeue.mockImplementationOnce(async () => null).mockImplementationOnce(async () => {
                service.stopWorker();
                return null;
            });
            const worker = service.startWorker();
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(1);
            sleep.resolve();
            await worker;
            expect(deps.dequeue).toHaveBeenCalledTimes(2);
        });

        it('serializes duplicate starts during startup and honors stop before startup completes', async () => {
            const startup = deferred();
            service.resetStaleProcessingTasks.mockReturnValue(startup.promise);
            const worker = service.startWorker();
            await service.startWorker();
            expect(service.resetStaleProcessingTasks).toHaveBeenCalledTimes(1);
            service.stopWorker();
            startup.resolve();
            await worker;
            expect(state.running).toBe(false);
            expect(deps.dequeue).not.toHaveBeenCalled();
        });

        it('joins a stopping loop before restart, requeueing a task claimed during stop', async () => {
            const lookup = deferred();
            deps.dequeue.mockImplementationOnce(() => lookup.promise);
            const worker = service.startWorker();
            await turn();
            service.stopWorker();
            const restart = service.startWorker();
            expect(service.resetStaleProcessingTasks).toHaveBeenCalledTimes(1);
            lookup.resolve({ id: 42, task_type: 'metadata_enrichment', claim_token: '11111111-1111-4111-8111-111111111111' });
            await worker;
            await turn();
            expect(service.resetStaleProcessingTasks).toHaveBeenCalledTimes(2);
            expect(deps.db.query).toHaveBeenCalledWith(expect.stringContaining('claim_token = $2::uuid'), [42, '11111111-1111-4111-8111-111111111111', null]);
            expect(deps.processTask).not.toHaveBeenCalled();
            service.stopWorker();
            await restart;
        });

        it('stops and releases reservation during AI-unavailable cooldown despite work notifications', async () => {
            deps.dequeue.mockResolvedValue({ id: 42, task_type: 'classification' });
            deps.aiRouterService.checkAvailability.mockResolvedValue(false);
            const release = jest.fn();
            service.resourceAdmission = { tryAcquire: () => ({ allowed: true, release }) };
            const worker = service.startWorker();
            await turn();
            service.notifyWorkAvailable();
            await turn();
            expect(deps.dequeue).toHaveBeenCalledTimes(1);
            service.stopWorker();
            await worker;
            expect(release).toHaveBeenCalledTimes(1);
            expect(deps.processTask).not.toHaveBeenCalled();
        });

        it('honors a later stop that supersedes a queued restart', async () => {
            const lookup = deferred();
            deps.dequeue.mockImplementationOnce(() => lookup.promise);
            const worker = service.startWorker();
            await turn();
            service.stopWorker();
            const restart = service.startWorker();
            service.stopWorker();
            lookup.resolve(null);
            await Promise.all([worker, restart]);
            expect(service.resetStaleProcessingTasks).toHaveBeenCalledTimes(1);
            expect(state.running).toBe(false);
        });
    });
});
