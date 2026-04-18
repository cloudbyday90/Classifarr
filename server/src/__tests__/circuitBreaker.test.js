/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: () => mockLogger
}));

const CircuitBreaker = require('../services/circuitBreaker');
const { STATES } = require('../services/circuitBreaker');

describe('CircuitBreaker', () => {
    let circuitBreaker;

    beforeEach(() => {
        jest.clearAllMocks();
        circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            recoveryTimeout: 1000,
            halfOpenMaxAttempts: 2
        });
    });

    describe('initial state', () => {
        it('should start in CLOSED state', () => {
            expect(circuitBreaker.state).toBe(STATES.CLOSED);
        });

        it('should allow requests initially', () => {
            expect(circuitBreaker.isAllowed()).toBe(true);
        });
    });

    describe('CLOSED state', () => {
        it('should allow all requests', () => {
            expect(circuitBreaker.isAllowed()).toBe(true);
            expect(circuitBreaker.isAllowed()).toBe(true);
            expect(circuitBreaker.isAllowed()).toBe(true);
        });

        it('should reset failure count on success', () => {
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            expect(circuitBreaker.failureCount).toBe(2);

            circuitBreaker.recordSuccess();
            expect(circuitBreaker.failureCount).toBe(0);
        });

        it('should transition to OPEN after threshold failures', () => {
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            expect(circuitBreaker.state).toBe(STATES.CLOSED);

            circuitBreaker.recordFailure(new Error('test'));
            expect(circuitBreaker.state).toBe(STATES.OPEN);
        });

        it('should emit non-persistent debug diagnostics for recorded failures', () => {
            const err = new Error('timeout of 15000ms exceeded');
            circuitBreaker.recordFailure(err);

            expect(mockLogger.debug).toHaveBeenCalled();
            const call = mockLogger.debug.mock.calls[0];
            expect(call[0]).toBe('Circuit breaker recorded failure');
            expect(call[2]).toEqual({ skipDbPersist: true });
        });
    });

    describe('OPEN state', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Trigger OPEN state
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should reject requests', () => {
            expect(circuitBreaker.isAllowed()).toBe(false);
            expect(circuitBreaker.metrics.rejectedRequests).toBe(1);
        });

        it('should transition to HALF_OPEN after recovery timeout', () => {
            jest.advanceTimersByTime(1100);
            expect(circuitBreaker.isAllowed()).toBe(true);
            expect(circuitBreaker.state).toBe(STATES.HALF_OPEN);
        });

        it('should track rejected requests', () => {
            circuitBreaker.isAllowed();
            circuitBreaker.isAllowed();
            circuitBreaker.isAllowed();

            expect(circuitBreaker.metrics.rejectedRequests).toBe(3);
        });
    });

    describe('HALF_OPEN state', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            // Trigger OPEN state
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));

            // Advance past recovery timeout and trigger HALF_OPEN transition
            jest.advanceTimersByTime(1100);
            circuitBreaker.isAllowed(); // Trigger transition
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should allow limited requests', () => {
            expect(circuitBreaker.isAllowed()).toBe(true);
            expect(circuitBreaker.isAllowed()).toBe(true);
            expect(circuitBreaker.isAllowed()).toBe(false); // Max attempts reached
        });

        it('should transition to CLOSED on successful recovery', () => {
            circuitBreaker.isAllowed();
            circuitBreaker.recordSuccess();
            circuitBreaker.isAllowed();
            circuitBreaker.recordSuccess();

            expect(circuitBreaker.state).toBe(STATES.CLOSED);
            expect(circuitBreaker.failureCount).toBe(0);
        });

        it('should transition back to OPEN on failure', () => {
            circuitBreaker.isAllowed();
            circuitBreaker.recordFailure(new Error('test'));

            expect(circuitBreaker.state).toBe(STATES.OPEN);
        });
    });

    describe('reset', () => {
        it('should reset to CLOSED state', () => {
            // Trigger OPEN state
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            
            expect(circuitBreaker.state).toBe(STATES.OPEN);

            circuitBreaker.reset();

            expect(circuitBreaker.state).toBe(STATES.CLOSED);
            expect(circuitBreaker.failureCount).toBe(0);
            expect(circuitBreaker.successCount).toBe(0);
        });
    });

    describe('getStatus', () => {
        it('should return status information', () => {
            circuitBreaker.recordFailure(new Error('test'));
            
            const status = circuitBreaker.getStatus();

            expect(status).toHaveProperty('state');
            expect(status).toHaveProperty('failureCount');
            expect(status).toHaveProperty('successCount');
            expect(status).toHaveProperty('lastFailureTime');
            expect(status).toHaveProperty('metrics');
            expect(status).toHaveProperty('config');

            expect(status.state).toBe(STATES.CLOSED);
            expect(status.failureCount).toBe(1);
        });
    });

    describe('getStateHistory', () => {
        it('should track state transitions', () => {
            // Initial state
            expect(circuitBreaker.stateHistory.length).toBe(1);

            // Trigger OPEN
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));

            const history = circuitBreaker.getStateHistory();
            
            expect(history.length).toBe(2);
            expect(history[0].state).toBe(STATES.CLOSED);
            expect(history[1].from).toBe(STATES.CLOSED);
            expect(history[1].to).toBe(STATES.OPEN);
        });

        it('should limit history size', () => {
            const history = circuitBreaker.getStateHistory(1);
            expect(history.length).toBeLessThanOrEqual(1);
        });
    });

    describe('getMetrics', () => {
        it('should return metrics data', () => {
            circuitBreaker.isAllowed();
            circuitBreaker.recordSuccess();
            circuitBreaker.recordFailure(new Error('test'));

            const metrics = circuitBreaker.getMetrics();

            expect(metrics).toHaveProperty('totalRequests');
            expect(metrics).toHaveProperty('successfulRequests');
            expect(metrics).toHaveProperty('failedRequests');
            expect(metrics).toHaveProperty('rejectedRequests');
            expect(metrics).toHaveProperty('currentState');
            expect(metrics).toHaveProperty('failureCount');
            expect(metrics).toHaveProperty('successCount');

            expect(metrics.totalRequests).toBe(1);
            expect(metrics.successfulRequests).toBe(1);
            expect(metrics.failedRequests).toBe(1);
        });
    });

    describe('name option (Gap 3.22)', () => {
        it('should use named logger when name is provided', () => {
            const named = new CircuitBreaker({ name: 'ImageEmbedding' });
            expect(named.name).toBe('ImageEmbedding');
            // createLogger is mocked — the instance is the shared mockLogger;
            // just verify the property is set correctly
            expect(named._logger).toBeDefined();
        });

        it('should have null name when not provided', () => {
            const unnamed = new CircuitBreaker({});
            expect(unnamed.name).toBeNull();
        });
    });

    describe('stateChanges cap (Gap 3.20)', () => {
        it('should cap stateChanges at 100 entries', () => {
            // Force 110 state transitions by alternating OPEN↔CLOSED
            for (let i = 0; i < 55; i++) {
                // Trip to OPEN
                circuitBreaker.failureCount = circuitBreaker.failureThreshold - 1;
                circuitBreaker.state = STATES.CLOSED;
                circuitBreaker.recordFailure(new Error('trip'));
                // Force back to CLOSED via reset
                circuitBreaker.state = STATES.CLOSED;
                circuitBreaker.failureCount = 0;
                circuitBreaker.transitionTo(STATES.OPEN, 'test');
                circuitBreaker.transitionTo(STATES.CLOSED, 'test');
            }

            expect(circuitBreaker.metrics.stateChanges.length).toBeLessThanOrEqual(100);
        });
    });

    describe('run(fn) (Gap 3.21)', () => {
        it('should return result on success', async () => {
            const result = await circuitBreaker.run(async () => 'value');
            expect(result).toBe('value');
            expect(circuitBreaker.metrics.successfulRequests).toBeGreaterThan(0);
        });

        it('should throw CIRCUIT_OPEN when circuit is open', async () => {
            // Trip to OPEN
            circuitBreaker.recordFailure(new Error('a'));
            circuitBreaker.recordFailure(new Error('b'));
            circuitBreaker.recordFailure(new Error('c'));
            expect(circuitBreaker.state).toBe(STATES.OPEN);

            await expect(circuitBreaker.run(async () => {})).rejects.toMatchObject({
                code: 'CIRCUIT_OPEN'
            });
        });

        it('should record failure and rethrow on regular error', async () => {
            const before = circuitBreaker.metrics.failedRequests;
            const err = new Error('provider down');

            await expect(
                circuitBreaker.run(async () => { throw err; })
            ).rejects.toThrow('provider down');

            expect(circuitBreaker.metrics.failedRequests).toBe(before + 1);
        });

        it('should NOT record failure for AbortError', async () => {
            const before = circuitBreaker.metrics.failedRequests;
            const abortErr = new Error('aborted');
            abortErr.name = 'AbortError';

            await expect(
                circuitBreaker.run(async () => { throw abortErr; })
            ).rejects.toMatchObject({ name: 'AbortError' });

            expect(circuitBreaker.metrics.failedRequests).toBe(before);
        });
    });
});
