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

// Mock logger
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

const CircuitBreaker = require('../services/circuitBreaker');
const { STATES } = require('../services/circuitBreaker');

describe('CircuitBreaker', () => {
    let circuitBreaker;

    beforeEach(() => {
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
    });

    describe('OPEN state', () => {
        beforeEach(() => {
            // Trigger OPEN state
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
        });

        it('should reject requests', () => {
            expect(circuitBreaker.isAllowed()).toBe(false);
            expect(circuitBreaker.metrics.rejectedRequests).toBe(1);
        });

        it('should transition to HALF_OPEN after recovery timeout', (done) => {
            setTimeout(() => {
                expect(circuitBreaker.isAllowed()).toBe(true);
                expect(circuitBreaker.state).toBe(STATES.HALF_OPEN);
                done();
            }, 1100);
        });

        it('should track rejected requests', () => {
            circuitBreaker.isAllowed();
            circuitBreaker.isAllowed();
            circuitBreaker.isAllowed();

            expect(circuitBreaker.metrics.rejectedRequests).toBe(3);
        });
    });

    describe('HALF_OPEN state', () => {
        beforeEach((done) => {
            // Trigger OPEN state
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));
            circuitBreaker.recordFailure(new Error('test'));

            // Wait for transition to HALF_OPEN
            setTimeout(() => {
                circuitBreaker.isAllowed(); // Trigger transition
                done();
            }, 1100);
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
});
