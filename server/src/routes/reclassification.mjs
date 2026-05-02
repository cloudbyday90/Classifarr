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
import reclassificationBatchService from '../services/reclassificationBatchService.mjs';
import { createReclassificationRouter } from './reclassificationRouteShared.mjs';

const router = createReclassificationRouter({
  express,
  reclassificationBatchService,
});

export default router;
