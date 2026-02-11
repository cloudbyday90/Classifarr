/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

// Mock logger
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: () => mockLogger
}));

// Mock CircuitBreaker to avoid actual state management in tests
const mockCircuitBreaker = {
    isAllowed: jest.fn(() => true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
    reset: jest.fn(),
    getStatus: jest.fn(() => ({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: null,
        metrics: {},
        config: {}
    })),
    failureThreshold: 3,
    recoveryTimeout: 30000
};

jest.mock('../services/circuitBreaker', () => {
    return jest.fn().mockImplementation(() => mockCircuitBreaker);
});

const omdbCircuitBreaker = require('../utils/omdbCircuitBreaker');

describe('OMDb Circuit Breaker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockCircuitBreaker.isAllowed.mockReturnValue(true);
        mockCircuitBreaker.getStatus.mockReturnValue({
            state: 'CLOSED',
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            metrics: {},
            config: {}
        });
    });

    describe('shouldTripBreaker', () => {
        it('should trip on ECONNABORTED', () => {
            const error = new Error('Connection aborted');
            error.code = 'ECONNABORTED';
            expect(omdbCircuitBreaker.shouldTripBreaker(error)).toBe(true);
        });

        it('should trip on ETIMEDOUT', () => {
            const error = new Error('Connection timed out');
            error.code = 'ETIMEDOUT';
            expect(omdbCircuitBreaker.shouldTripBreaker(error)).toBe(true);
        });

        it('should trip on ECONNREFUSED', () => {
            const error = new Error('Connection refused');
            error.code = 'ECONNREFUSED';
            expect(omdbCircuitBreaker.shouldTripBreaker(error)).toBe(true);
        });

        it('should not trip on 401 errors', () => {
            const error = new Error('Unauthorized');
            error.code = 'ERR_BAD_REQUEST';
            expect(omdbCircuitBreaker.shouldTripBreaker(error)).toBe(false);
        });

        it('should not trip on 404 errors', () => {
            const error = new Error('Not found');
            error.code = 'ERR_BAD_RESPONSE';
            expect(omdbCircuitBreaker.shouldTripBreaker(error)).toBe(false);
        });
    });

    describe('execute', () => {
        it('should execute function and record success', async () => {
            const fn = jest.fn().mockResolvedValue('result');
            
            const result = await omdbCircuitBreaker.execute(fn);
            
            expect(result).toBe('result');
            expect(fn).toHaveBeenCalled();
            expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
        });

        it('should record failure for network errors', async () => {
            const error = new Error('Timeout');
            error.code = 'ETIMEDOUT';
            const fn = jest.fn().mockRejectedValue(error);
            
            await expect(omdbCircuitBreaker.execute(fn)).rejects.toThrow('Timeout');
            expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledWith(error);
        });

        it('should not record failure for non-network errors', async () => {
            const error = new Error('Unauthorized');
            error.code = 'ERR_UNAUTHORIZED';
            const fn = jest.fn().mockRejectedValue(error);
            
            await expect(omdbCircuitBreaker.execute(fn)).rejects.toThrow('Unauthorized');
            expect(mockCircuitBreaker.recordFailure).not.toHaveBeenCalled();
        });

        it('should throw CIRCUIT_BREAKER_OPEN error when circuit is open', async () => {
            mockCircuitBreaker.isAllowed.mockReturnValue(false);
            mockCircuitBreaker.getStatus.mockReturnValue({
                state: 'OPEN',
                failureCount: 3,
                lastFailureTime: Date.now()
            });
            
            const fn = jest.fn();
            
            await expect(omdbCircuitBreaker.execute(fn)).rejects.toThrow('OMDb circuit breaker is OPEN');
            expect(fn).not.toHaveBeenCalled();
        });

        it('should treat HALF_OPEN throttling as debug-only (not warn)', async () => {
            mockCircuitBreaker.isAllowed.mockReturnValue(false);
            mockCircuitBreaker.getStatus.mockReturnValue({
                state: 'HALF_OPEN',
                failureCount: 3,
                lastFailureTime: Date.now()
            });

            const fn = jest.fn();

            await expect(omdbCircuitBreaker.execute(fn)).rejects.toThrow(
                'OMDb circuit breaker is HALF_OPEN and maximum concurrent attempts have been reached'
            );
            expect(fn).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'OMDb circuit breaker HALF_OPEN throttled request',
                expect.objectContaining({ state: 'HALF_OPEN', failureCount: 3 })
            );
        });
    });

    describe('getStatus', () => {
        it('should return circuit breaker status with nextAttempt', () => {
            const lastFailureTime = Date.now() - 10000;
            mockCircuitBreaker.getStatus.mockReturnValue({
                state: 'OPEN',
                failureCount: 3,
                successCount: 0,
                lastFailureTime,
                metrics: { totalRequests: 10 },
                config: { failureThreshold: 3 }
            });
            
            const status = omdbCircuitBreaker.getStatus();
            
            expect(status.state).toBe('OPEN');
            expect(status.failureCount).toBe(3);
            expect(status.nextAttempt).toBe(lastFailureTime + 30000);
        });

        it('should return null nextAttempt when no failures', () => {
            const status = omdbCircuitBreaker.getStatus();
            expect(status.nextAttempt).toBeNull();
        });
    });

    describe('reset', () => {
        it('should reset the circuit breaker', () => {
            omdbCircuitBreaker.reset();
            expect(mockCircuitBreaker.reset).toHaveBeenCalled();
        });
    });
});
