/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createBackgroundResourceAdmission } from '../../services/backgroundResourceAdmission.mjs';

/** Real admission policy with deterministic telemetry, not a permissive mock. */
export function resourceAdmissionFixture(readMemory = () => ({ available: 8e9, constrained: 8e9, total: 16e9 })) {
  return createBackgroundResourceAdmission({ readMemory });
}
