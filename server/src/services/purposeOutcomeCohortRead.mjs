/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { buildPurposeOutcomeCohortReport } from './purposeOutcomeCohortReport.mjs';
import { withPurposeOutcomeSnapshot } from './purposeOutcomeSnapshotRead.mjs';

export function readPurposeOutcomeCohort(runtime, options = {}) {
  return withPurposeOutcomeSnapshot(runtime, options, buildPurposeOutcomeCohortReport);
}
