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

import { jest } from '@jest/globals';
import {
    calculateBackoff,
    parseRetryAfter,
    isRetryableError,
    getRetryDelay,
    withRetry
} from '../utils/retryUtils.mjs';

describe('RetryUtils', () => {
    describe('calculateBackoff', () => {
        it('should calculate exponential backoff', () => {
            const delay0 = calculateBackoff(0, { baseDelay: 1000, multiplier: 2, jitter: 0 });
            const delay1 = calculateBackoff(1, { baseDelay: 1000, multiplier: 2, jitter: 0 });
            const delay2 = calculateBackoff(2, { baseDelay: 1000, multiplier: 2, jitter: 0 });

            expect(delay0).toBe(1000);
            expect(delay1).toBe(2000);
            expect(delay2).toBe(4000);
        });

        it('should apply jitter to delays', () => {
            const results = [];
            for (let index = 0; index < 100; index++) {
                const delay = calculateBackoff(0, { baseDelay: 1000, multiplier: 2, jitter: 0.3 });
                results.push(delay);
            }

            const min = Math.min(...results);
            const max = Math.max(...results);

            expect(min).toBeGreaterThanOrEqual(700);
            expect(max).toBeLessThanOrEqual(1300);
            expect(new Set(results).size).toBeGreaterThan(1);
        });

        it('should cap delays at maxDelay', () => {
            const delay = calculateBackoff(10, { baseDelay: 1000, multiplier: 2, jitter: 0, maxDelay: 10000 });

            expect(delay).toBeLessThanOrEqual(10000);
        });
    });

    describe('parseRetryAfter', () => {
        it('should parse delay-seconds format', () => {
            expect(parseRetryAfter('5')).toBe(5000);
            expect(parseRetryAfter('30')).toBe(30000);
        });

        it('should parse HTTP-date format', () => {
            const futureDate = new Date(Date.now() + 5000);
            const delay = parseRetryAfter(futureDate.toUTCString());

            expect(delay).toBeGreaterThanOrEqual(4000);
            expect(delay).toBeLessThanOrEqual(6000);
        });

        it('should return null for invalid headers', () => {
            expect(parseRetryAfter(null)).toBeNull();
            expect(parseRetryAfter('')).toBeNull();
            expect(parseRetryAfter('invalid')).toBeNull();
        });
    });

    describe('isRetryableError', () => {
        it('should identify network errors as retryable', () => {
            const errors = [
                { code: 'ECONNRESET' },
                { code: 'ENOTFOUND' },
                { code: 'ETIMEDOUT' },
                { code: 'ECONNREFUSED' }
            ];

            errors.forEach(error => {
                expect(isRetryableError(error)).toBe(true);
            });
        });

        it('should identify 429 as retryable', () => {
            const error = { response: { status: 429 } };
            expect(isRetryableError(error)).toBe(true);
        });

        it('should identify 5xx errors as retryable', () => {
            const errors = [
                { response: { status: 500 } },
                { response: { status: 502 } },
                { response: { status: 503 } },
                { response: { status: 504 } }
            ];

            errors.forEach(error => {
                expect(isRetryableError(error)).toBe(true);
            });
        });

        it('should identify timeout errors as retryable', () => {
            const errors = [
                { message: 'Request timeout' },
                { message: 'Connection timed out' },
                { message: 'ETIMEDOUT occurred' }
            ];

            errors.forEach(error => {
                expect(isRetryableError(error)).toBe(true);
            });
        });

        it('should not retry 4xx client errors (except 408, 429)', () => {
            const errors = [
                { response: { status: 400 } },
                { response: { status: 401 } },
                { response: { status: 403 } },
                { response: { status: 404 } }
            ];

            errors.forEach(error => {
                expect(isRetryableError(error)).toBe(false);
            });
        });

        it('should retry 408 request timeout', () => {
            const error = { response: { status: 408 } };
            expect(isRetryableError(error)).toBe(true);
        });
    });

    describe('getRetryDelay', () => {
        it('should honor Retry-After header when present', () => {
            const error = {
                response: {
                    headers: {
                        'retry-after': '10'
                    }
                }
            };

            const delay = getRetryDelay(error, 0);
            expect(delay).toBe(10000);
        });

        it('should fall back to exponential backoff when no Retry-After', () => {
            const error = { response: { status: 500 } };
            const delay = getRetryDelay(error, 1, { baseDelay: 1000, multiplier: 2, jitter: 0 });

            expect(delay).toBe(2000);
        });
    });

    describe('withRetry', () => {
        it('should succeed on first try', async () => {
            const fn = jest.fn().mockResolvedValue('success');
            const wrappedFn = withRetry(fn, { maxRetries: 3 });

            const result = await wrappedFn();

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry on retryable errors', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce({ response: { status: 500 } })
                .mockRejectedValueOnce({ response: { status: 503 } })
                .mockResolvedValue('success');

            const wrappedFn = withRetry(fn, { maxRetries: 3, baseDelay: 10 });

            const result = await wrappedFn();

            expect(result).toBe('success');
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should not retry on non-retryable errors', async () => {
            const fn = jest.fn().mockRejectedValue({ response: { status: 404 } });
            const wrappedFn = withRetry(fn, { maxRetries: 3 });

            await expect(wrappedFn()).rejects.toEqual({ response: { status: 404 } });
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should throw after max retries exceeded', async () => {
            const fn = jest.fn().mockRejectedValue({ response: { status: 500 } });
            const wrappedFn = withRetry(fn, { maxRetries: 2, baseDelay: 10 });

            await expect(wrappedFn()).rejects.toEqual({ response: { status: 500 } });
            expect(fn).toHaveBeenCalledTimes(3);
        });

        it('should call onRetry callback', async () => {
            const fn = jest.fn()
                .mockRejectedValueOnce({ response: { status: 500 } })
                .mockResolvedValue('success');

            const onRetry = jest.fn();
            const wrappedFn = withRetry(fn, { maxRetries: 3, baseDelay: 10, onRetry });

            await wrappedFn();

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(
                expect.objectContaining({ response: { status: 500 } }),
                0,
                expect.any(Number)
            );
        });
    });
});
