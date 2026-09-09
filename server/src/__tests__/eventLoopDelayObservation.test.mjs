/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { EventEmitter } from 'node:events';
import { jest, describe, expect, test } from '@jest/globals';
import {
    buildEventLoopDelayReceipt,
    EVENT_LOOP_DELAY_RECEIPT_VERSION,
} from '../services/eventLoopDelayReceipt.mjs';
import { incrementEventLoopDelayReceipt } from '../services/eventLoopDelayReceiptRepository.mjs';
import { createEventLoopDelayObservationService } from '../services/eventLoopDelayObservationService.mjs';
import {
    registerEventLoopDelayObservationSchedule,
    stopEventLoopDelayObservationSchedule,
} from '../services/eventLoopDelayObservationScheduler.mjs';
import {
    EVENT_LOOP_DELAY_OBSERVATION_CRON,
    EVENT_LOOP_DELAY_OBSERVATION_INITIAL_DELAY_MS,
    EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
} from '../services/eventLoopDelayObservationSchedule.mjs';
import { createNpmRunInvocation, runScript } from '../../../scripts/run-workspace-tests.mjs';

describe('event-loop delay receipt contract', () => {
    test('reduces raw histogram data to a fixed p99 bucket', () => {
        expect(buildEventLoopDelayReceipt({
            p99DelayNanoseconds: 49_999_999,
            sampleCount: 1,
        })).toEqual({
            version: EVENT_LOOP_DELAY_RECEIPT_VERSION,
            p99DelayBucket: '25_to_49ms',
            observationCount: 1,
        });
    });

    test('marks empty or malformed histograms unavailable without retaining raw fields', () => {
        const receipt = buildEventLoopDelayReceipt({
            p99DelayNanoseconds: 500_000_000,
            sampleCount: 0,
        });
        expect(receipt).toEqual({
            version: EVENT_LOOP_DELAY_RECEIPT_VERSION,
            p99DelayBucket: 'unavailable',
            observationCount: 1,
        });
        expect(receipt).not.toHaveProperty('p99DelayNanoseconds');
        expect(receipt).not.toHaveProperty('sampleCount');
    });

    test('uses a parameterized fixed-dimension upsert', async () => {
        const query = jest.fn().mockResolvedValue({});
        await incrementEventLoopDelayReceipt({ query }, buildEventLoopDelayReceipt({
            p99DelayNanoseconds: 101_000_000,
            sampleCount: 10,
        }));

        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('ON CONFLICT (receipt_version, p99_delay_bucket)'),
            [EVENT_LOOP_DELAY_RECEIPT_VERSION, '100_to_499ms', 1],
        );
    });
});

describe('event-loop delay observation service', () => {
    function createHistogram({ count = 4, p99DelayNanoseconds = 50_000_000 } = {}) {
        return {
            count,
            disable: jest.fn(),
            enable: jest.fn(),
            percentile: jest.fn().mockReturnValue(p99DelayNanoseconds),
            reset: jest.fn(),
        };
    }

    test('starts one histogram, resets each observed window, and persists only its bucket', async () => {
        const histogram = createHistogram();
        const createHistogramFactory = jest.fn().mockReturnValue(histogram);
        const incrementReceipt = jest.fn().mockResolvedValue(undefined);
        const service = createEventLoopDelayObservationService({
            createHistogram: createHistogramFactory,
            incrementReceipt,
            logger: { warn: jest.fn() },
        });

        expect(service.snapshot()).toBeNull();
        expect(service.start()).toBe(true);
        expect(service.start()).toBe(false);
        await expect(service.observe()).resolves.toEqual({
            version: EVENT_LOOP_DELAY_RECEIPT_VERSION,
            p99DelayBucket: '50_to_99ms',
            observationCount: 1,
        });
        expect(createHistogramFactory).toHaveBeenCalledWith({ resolution: 20 });
        expect(histogram.reset).toHaveBeenCalledTimes(1);
        expect(incrementReceipt).toHaveBeenCalledWith(expect.anything(), {
            version: EVENT_LOOP_DELAY_RECEIPT_VERSION,
            p99DelayBucket: '50_to_99ms',
            observationCount: 1,
        });
        expect(service.stop()).toBe(true);
        expect(histogram.disable).toHaveBeenCalledTimes(1);
    });

    test('contains histogram and persistence faults outside platform work', async () => {
        const logger = { warn: jest.fn() };
        const failingHistogram = createHistogram();
        failingHistogram.percentile.mockImplementation(() => { throw new Error('unavailable'); });
        const unavailable = createEventLoopDelayObservationService({
            createHistogram: () => failingHistogram,
            incrementReceipt: jest.fn(),
            logger,
        });
        unavailable.start();
        expect(unavailable.snapshot()).toBeNull();

        const persistenceFailure = createEventLoopDelayObservationService({
            createHistogram: () => createHistogram(),
            incrementReceipt: jest.fn().mockRejectedValue(new Error('offline')),
            logger,
        });
        persistenceFailure.start();
        await expect(persistenceFailure.observe()).resolves.toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ reasonCode: expect.any(String) }),
            { skipDbPersist: true },
        );
    });
});

describe('event-loop delay schedule', () => {
    test('starts local observation and registers fixed recurring and delayed runs', () => {
        const scheduler = {
            schedule: jest.fn(),
            scheduleInitial: jest.fn(),
        };
        const observer = {
            observe: jest.fn(),
            start: jest.fn(),
        };

        expect(registerEventLoopDelayObservationSchedule(scheduler, { observer })).toBe(true);
        expect(observer.start).toHaveBeenCalledTimes(1);
        expect(scheduler.schedule).toHaveBeenCalledWith(
            EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
            EVENT_LOOP_DELAY_OBSERVATION_CRON,
            expect.any(Function),
            null,
            { noOverlap: true },
        );
        expect(scheduler.scheduleInitial).toHaveBeenCalledWith(
            EVENT_LOOP_DELAY_OBSERVATION_TASK_NAME,
            EVENT_LOOP_DELAY_OBSERVATION_INITIAL_DELAY_MS,
            expect.any(Function),
        );
    });

    test('stops local sampling during scheduler lifecycle cleanup', () => {
        const observer = { stop: jest.fn().mockReturnValue(true) };

        expect(stopEventLoopDelayObservationSchedule({ observer })).toBe(true);
        expect(observer.stop).toHaveBeenCalledTimes(1);
    });

    test('contains local histogram shutdown faults', () => {
        const log = { warn: jest.fn() };
        const observer = { stop: jest.fn(() => { throw new Error('unavailable'); }) };

        expect(stopEventLoopDelayObservationSchedule({ observer, log })).toBe(false);
        expect(log.warn).toHaveBeenCalledWith('Passive event-loop delay monitoring shutdown unavailable');
    });
});

describe('workspace test launcher', () => {
    test('uses an explicit command interpreter without shell mode on Windows', () => {
        expect(createNpmRunInvocation('test:server', { platform: 'win32' })).toEqual({
            command: 'cmd.exe',
            args: ['/d', '/s', '/c', 'npm.cmd', 'run', 'test:server'],
        });
        expect(createNpmRunInvocation('test:server', { platform: 'linux' })).toEqual({
            command: 'npm',
            args: ['run', 'test:server'],
        });
        expect(() => createNpmRunInvocation('test:server & whoami', { platform: 'win32' }))
            .toThrow(TypeError);
    });

    test('settles with a failure when the process cannot be spawned', async () => {
        const child = new EventEmitter();
        const spawnProcess = jest.fn().mockReturnValue(child);
        const now = jest.fn()
            .mockReturnValueOnce(100)
            .mockReturnValueOnce(125);

        const result = runScript('test:server', { now, spawnProcess });
        child.emit('error', new Error('command unavailable'));

        await expect(result).resolves.toEqual({
            code: 1,
            durationMs: 25,
            scriptName: 'test:server',
            signal: null,
        });
    });
});
