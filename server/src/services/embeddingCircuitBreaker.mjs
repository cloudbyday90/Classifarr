/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import CircuitBreaker from './circuitBreaker.mjs';

export const OPEN_CIRCUIT_ERROR_MESSAGE = 'Circuit breaker is OPEN - embedding provider cooldown active';

export const embeddingCircuitBreaker = new CircuitBreaker({
    name: 'TextEmbedding',
    failureThreshold: 5,
    recoveryTimeout: 60000,
    halfOpenMaxAttempts: 3
});
