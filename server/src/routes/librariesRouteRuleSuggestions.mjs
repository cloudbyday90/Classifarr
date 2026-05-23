/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { registerBasicSuggestRoute } from './librariesRouteRuleSuggestBasic.mjs';
import { registerSmartSuggestRoute } from './librariesRouteRuleSuggestSmart.mjs';
import { registerAutoGenerateRoutes } from './librariesRouteRuleAutoGenerate.mjs';

export function registerRuleSuggestionRoutes(router, { db, ollamaService, normalizeMetadataListLower, requireReadWrite, metadataEnrichment, logger }) {
  registerBasicSuggestRoute(router, { db, normalizeMetadataListLower });
  registerSmartSuggestRoute(router, { db, ollamaService, metadataEnrichment, logger });
  registerAutoGenerateRoutes(router, { db, requireReadWrite, logger });
}
