/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_DIAGNOSTIC_VERSION,
  POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS,
  buildPolicyCompatibilityRemovalExporterDiagnostic,
} from '../../../../scripts/lib/policyCompatibilityRemovalExporterDiagnostic.mjs';

describe('policyCompatibilityRemovalExporterDiagnostic', () => {
  test('keeps a cutover diagnostic bounded to fixed IDs and one next step', () => {
    const diagnostic = buildPolicyCompatibilityRemovalExporterDiagnostic({
      exporterId:
        POLICY_COMPATIBILITY_REMOVAL_EXPORTER_IDS.NEXT_BATCH_AUTHORIZATION,
      runtimeEvidenceCutover: {
        requiredRuntimeEvidenceVersion:
          'policy.post_removal_runtime_evidence_artifact.v2',
        reasonIds: [
          'execution_plan_fingerprint_mismatch',
          'execution_plan_fingerprint_mismatch',
        ],
        nextStep: {
          stepId: 'regenerate_current_runtime_evidence',
          label: 'Regenerate Current Runtime Evidence',
          reason: 'Current evidence is required.',
        },
      },
    });

    expect(diagnostic).toEqual({
      version: POLICY_COMPATIBILITY_REMOVAL_EXPORTER_DIAGNOSTIC_VERSION,
      statusId: 'blocked',
      authoritative: false,
      exporterId: 'next_batch_authorization',
      runtimeEvidenceContract: {
        requiredVersion: 'policy.post_removal_runtime_evidence_artifact.v2',
        reasonIds: ['execution_plan_fingerprint_mismatch'],
      },
      nextStep: {
        stepId: 'regenerate_current_runtime_evidence',
        label: 'Regenerate Current Runtime Evidence',
        reason: 'Current evidence is required.',
      },
    });
  });
});
