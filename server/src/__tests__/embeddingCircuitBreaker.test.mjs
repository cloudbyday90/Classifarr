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

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
  default: {
    createLogger: () => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    })
  },
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

const { default: CircuitBreaker } = await import('../services/circuitBreaker.mjs');
const { embeddingCircuitBreaker, OPEN_CIRCUIT_ERROR_MESSAGE } = await import('../services/embeddingCircuitBreaker.mjs');

describe('OPEN_CIRCUIT_ERROR_MESSAGE', () => {
  test('is a non-empty string', () => {
    expect(typeof OPEN_CIRCUIT_ERROR_MESSAGE).toBe('string');
    expect(OPEN_CIRCUIT_ERROR_MESSAGE.length).toBeGreaterThan(0);
  });

  test('mentions circuit breaker being OPEN', () => {
    expect(OPEN_CIRCUIT_ERROR_MESSAGE).toMatch(/OPEN/);
  });
});

describe('embeddingCircuitBreaker', () => {
  test('is an instance of CircuitBreaker', () => {
    expect(embeddingCircuitBreaker).toBeInstanceOf(CircuitBreaker);
  });

  test('failureThreshold is 5', () => {
    expect(embeddingCircuitBreaker.failureThreshold).toBe(5);
  });

  test('recoveryTimeout is 60000ms (1 minute)', () => {
    expect(embeddingCircuitBreaker.recoveryTimeout).toBe(60000);
  });

  test('halfOpenMaxAttempts is 3', () => {
    expect(embeddingCircuitBreaker.halfOpenMaxAttempts).toBe(3);
  });

  test('starts in CLOSED state', () => {
    expect(embeddingCircuitBreaker.state).toBe('CLOSED');
  });
});
