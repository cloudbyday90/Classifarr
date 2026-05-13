/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  detectEventTypesFromMetadata,
  mergeMetadataForRecheck as mergeMetadataForRecheckImpl,
  mightBeAnime,
  parseOverseerrPayload,
} from './classificationMetadataServiceShared.mjs';
import {
  enrichWithTMDB,
  enrichWithWebSearch,
  getTavilyConfig,
} from './classificationMetadataEnrichmentService.mjs';

export function mergeMetadataForRecheck(...args) {
  return mergeMetadataForRecheckImpl(...args);
}

export const classificationMetadataService = {
  detectEventTypesFromMetadata,
  enrichWithTMDB,
  enrichWithWebSearch,
  getTavilyConfig,
  mergeMetadataForRecheck,
  mightBeAnime,
  parseOverseerrPayload,
};

export {
  enrichWithTMDB,
  enrichWithWebSearch,
  getTavilyConfig,
};

export {
  detectEventTypesFromMetadata,
  mightBeAnime,
  parseOverseerrPayload,
} from './classificationMetadataServiceShared.mjs';
