/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import embeddingCircuitBreakerModule from './embeddingCircuitBreaker.shared.js';

export const OPEN_CIRCUIT_ERROR_MESSAGE = embeddingCircuitBreakerModule.OPEN_CIRCUIT_ERROR_MESSAGE;
export const embeddingCircuitBreaker = embeddingCircuitBreakerModule.embeddingCircuitBreaker;

export default embeddingCircuitBreakerModule;
