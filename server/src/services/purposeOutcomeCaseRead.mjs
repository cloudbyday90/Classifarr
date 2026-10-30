/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withPurposeOutcomeSnapshot } from './purposeOutcomeSnapshotRead.mjs';
import { buildPurposeOutcomeCaseReport } from './purposeOutcomeCaseReport.mjs';

export function readPurposeOutcomeCases(runtime, options = {}) {
  return withPurposeOutcomeSnapshot(runtime, options, buildPurposeOutcomeCaseReport);
}
