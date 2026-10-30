/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withPurposeOutcomeSnapshot } from './purposeOutcomeSnapshotRead.mjs';
import { buildPurposeOutcomeCaseReport } from './purposeOutcomeCaseReport.mjs';

export function readPurposeOutcomeCases(runtime, { signal, includePolicyContext = false } = {}) {
  return withPurposeOutcomeSnapshot(runtime, { signal, includePolicyContext }, input => buildPurposeOutcomeCaseReport(input, { includePolicyContext }));
}
