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
import { createLogger } from '../utils/logger.mjs';
import { ratingNormalizer } from '../utils/ratingNormalizer.mjs';
import { libraryProfileService } from '../services/libraryProfileService.mjs';
import { createRatingNormalizationRouter } from './ratingNormalizationRouteShared.mjs';


const logger = createLogger('RatingNormalizationAPI');

export const router = createRatingNormalizationRouter({
  express,
  db,
  logger,
  ratingNormalizer,
  libraryProfileService,
});
