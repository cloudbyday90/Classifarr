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
import { legacyMigrationService as legacyMigration } from '../services/legacyMigration.mjs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { createMigrationRouter } from './migrationRouteShared.mjs';


const logger = createLogger('MigrationRoute');

export const router = createMigrationRouter({
  express,
  legacyMigration,
  db,
  logger,
});
