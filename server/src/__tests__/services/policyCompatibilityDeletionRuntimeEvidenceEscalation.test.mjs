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
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS,
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS,
  buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation,
} from '../../services/policyCompatibilityDeletionRuntimeEvidenceEscalation.mjs';

function evaluate(overrides = {}) {
  return buildPolicyCompatibilityDeletionRuntimeEvidenceEscalation({
    artifactStatusId: 'observed',
    checkoutStatusId: 'observed',
    manifestStatusId: 'observed',
    runtimeEvidenceStatusId: 'observed',
    ...overrides,
  });
}

describe('policyCompatibilityDeletionRuntimeEvidenceEscalation', () => {
  test('keeps a current retained runtime-evidence reference without a probe', () => {
    expect(evaluate()).toEqual({
      version: 'policy.compatibility_deletion_runtime_evidence_escalation.v1',
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS
        .RETAINED_EVIDENCE_SUFFICIENT,
      reasonIds: [
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .RETAINED_EVIDENCE_CURRENT,
      ],
      runtimeProbeRequired: false,
      nextStep: {
        stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS
          .COMPLETE_EXECUTION_GATE,
      },
    });
  });

  test.each(['missing', 'stale'])(
    'requires the contained runtime probe only when retained evidence is %s',
    runtimeEvidenceStatusId => {
      const escalation = evaluate({ runtimeEvidenceStatusId });

      expect(escalation).toEqual(expect.objectContaining({
        statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS
          .PROBE_REQUIRED,
        runtimeProbeRequired: true,
        nextStep: {
          stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS
            .COLLECT_EMBEDDED_RUNTIME_EVIDENCE,
        },
      }));
      expect(escalation.reasonIds).toEqual([
        runtimeEvidenceStatusId === 'missing'
          ? POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
            .RETAINED_EVIDENCE_MISSING
          : POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
            .RETAINED_EVIDENCE_STALE,
      ]);
    }
  );

  test('blocks invalid runtime evidence instead of treating it as safe to refresh', () => {
    const escalation = evaluate({ runtimeEvidenceStatusId: 'invalid' });

    expect(escalation).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS.BLOCKED,
      runtimeProbeRequired: false,
      reasonIds: [
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .RETAINED_EVIDENCE_INVALID,
      ],
    }));
  });

  test('blocks rather than probing when checkout, manifest, or artifact evidence is not safe', () => {
    const escalation = evaluate({
      artifactStatusId: 'stale',
      checkoutStatusId: 'invalid',
      manifestStatusId: 'missing',
      runtimeEvidenceStatusId: 'missing',
    });

    expect(escalation).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS.BLOCKED,
      runtimeProbeRequired: false,
      nextStep: {
        stepId: POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STEP_IDS
          .REPAIR_PREFLIGHT,
      },
      reasonIds: [
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .ARTIFACT_NOT_OBSERVED,
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .CHECKOUT_NOT_OBSERVED,
        POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_REASON_IDS
          .MANIFEST_NOT_OBSERVED,
      ],
    }));
  });

  test('fails closed for an unrecognized observation status', () => {
    const escalation = evaluate({ runtimeEvidenceStatusId: 'caller_asserted_ready' });

    expect(escalation.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_RUNTIME_EVIDENCE_ESCALATION_STATUS_IDS.BLOCKED);
    expect(escalation.runtimeProbeRequired).toBe(false);
  });
});
