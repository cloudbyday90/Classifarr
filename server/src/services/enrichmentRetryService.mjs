/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const _cjs = _require('./enrichmentRetryService.shared.js');

export default _cjs;
export const {
    EnrichmentRetryService,
    TAVILY_MONTHLY_DEFERRED_REASON,
    TAVILY_MONTHLY_DEFERRED_MESSAGE,
    OMDB_FALLBACK_REASON,
    ENRICHMENT_RETRY_STALE_MS,
} = _cjs;
