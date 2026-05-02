/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import rateLimiter from './rateLimiter.shared.js';

const { RateLimiter, rateLimiters } = rateLimiter;

export { RateLimiter, rateLimiters };

export default rateLimiter;
