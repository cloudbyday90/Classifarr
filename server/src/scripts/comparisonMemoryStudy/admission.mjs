/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { observeStudyAdmission } from '../resourceStudyMetrics.mjs';

/** Observe actual permitted overlap, not merely simultaneous task requests. */
export function observeComparisonStudyAdmission(resourceAdmission) {
  const admission = observeStudyAdmission(resourceAdmission);
  const overlap = { ingestion: 0, queue: 0 };
  return { classes: admission.classes, overlap,
    tryAcquire(kind) {
      const permit = admission.tryAcquire(kind);
      if (permit.allowed && Object.hasOwn(overlap, kind) && admission.classes.discovery.active > 0) overlap[kind]++;
      return permit;
    } };
}
