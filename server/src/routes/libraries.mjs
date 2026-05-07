/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import * as db from '../config/database.mjs';
import radarrService from '../services/radarr.mjs';
import sonarrService from '../services/sonarr.mjs';
import ollamaService from '../services/ollama.mjs';
import mediaPatternAnalyzer from '../services/mediaPatternAnalyzer.mjs';
import libraryProfileService from '../services/libraryProfileService.mjs';
import mediaSyncService from '../services/mediaSync.mjs';
import { createLogger } from '../utils/logger.mjs';
import { normalizeMetadataListLower } from '../utils/metadataNormalization.mjs';
import { authenticateTokenOrApiKey, requireReadWrite } from '../middleware/apiKeyAuth.mjs';
import * as metadataEnrichment from '../utils/metadataEnrichment.mjs';
import * as errors from '../utils/errors.mjs';
import { createLibrariesRouter } from './librariesRouteShared.mjs';

const router = createLibrariesRouter({
  express,
  db,
  radarrService,
  sonarrService,
  ollamaService,
  mediaPatternAnalyzer,
  libraryProfileService,
  createLogger,
  normalizeMetadataListLower,
  authenticateTokenOrApiKey,
  requireReadWrite,
  mediaSyncService,
  metadataEnrichment,
  errors,
});

export default router;
