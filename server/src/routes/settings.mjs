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
import { authenticateToken, requireAdmin } from '../middleware/auth.mjs';
import { createSettingsRouteDependencies } from './settingsRouteDependencies.mjs';
import { createSettingsRouter } from './settingsRouteShared.mjs';

const routeDependencies = createSettingsRouteDependencies();

export const router = createSettingsRouter({
  express,
  authenticateToken,
  requireAdmin,
  ...routeDependencies,
});
