/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildRouteSafetyReadinessReport,
  buildRouteSafetyReadinessWindow,
} from './routeSafetyReadiness.mjs';
import {
  loadRouteSafetyReadinessPrimaryGateCounts,
} from './routeSafetyReadinessRepository.mjs';

/**
 * Separates the fixed aggregate query from the presentation contract. The
 * service owns neither AI calls nor policy/routing authority.
 */
export function createRouteSafetyReadinessService({
  database = db,
  loadPrimaryGateCounts = loadRouteSafetyReadinessPrimaryGateCounts,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const window = buildRouteSafetyReadinessWindow({ now: now() });
      const rows = await loadPrimaryGateCounts(database, window);
      return buildRouteSafetyReadinessReport({ rows, window });
    },
  });
}
