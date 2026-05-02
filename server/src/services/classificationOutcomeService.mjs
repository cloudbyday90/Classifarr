/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Persists compact, queryable post-classification outcomes back onto the
 * original classification_history row so second-pass quality can be evaluated
 * against later human confirmation/correction/retry behavior.
 */

import classificationOutcomeService from './classificationOutcomeService.shared.js';

export default classificationOutcomeService;
