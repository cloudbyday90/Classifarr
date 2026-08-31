/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import {
  buildRouteSafetyMaintenanceHandoffReport,
  buildRouteSafetyMaintenanceHandoffWindows,
} from './routeSafetyMaintenanceHandoff.mjs';
import {
  loadRouteSafetyMaintenanceHandoffGateCounts,
} from './routeSafetyMaintenanceHandoffRepository.mjs';

/**
 * Owns a read-only aggregate handoff. It has no AI, RAG, policy-write,
 * classification, retry, learning, or route authority.
 */
export function createRouteSafetyMaintenanceHandoffService({
  database = db,
  loadGateCounts = loadRouteSafetyMaintenanceHandoffGateCounts,
  now = () => new Date(),
} = {}) {
  return Object.freeze({
    async getReport() {
      const windows = buildRouteSafetyMaintenanceHandoffWindows({ now: now() });
      const rows = await loadGateCounts(database, windows);
      return buildRouteSafetyMaintenanceHandoffReport({ rows, windows });
    },
  });
}
