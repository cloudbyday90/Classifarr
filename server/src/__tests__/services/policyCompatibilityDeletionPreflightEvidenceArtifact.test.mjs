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
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS,
  buildPolicyCompatibilityDeletionPreflightEvidenceArtifact,
  validatePolicyCompatibilityDeletionPreflightEvidenceArtifact,
} from '../../services/policyCompatibilityDeletionPreflightEvidenceArtifact.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const MANIFEST_PATH = 'server/src/services/legacyCompatibilityBridge.mjs';

function buildReadyArtifact({ generatedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME } = {}) {
  return buildReadyExecutionPlanArtifact({
    generatedAt,
    executionPlan: {
      statusId: 'ready_for_execution_gate',
      readyForExecutionGate: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      manifest: {
        approved: true,
        approvedBy: 'policy-maintainer',
        entries: [{ path: MANIFEST_PATH }],
      },
    },
  });
}

function buildObservedEvidence(overrides = {}) {
  const artifact = overrides.executionPlanArtifact || buildReadyArtifact();

  return buildPolicyCompatibilityDeletionPreflightEvidenceArtifact({
    artifactObservation: {
      artifactPath: '.tmp/execution-plan-artifact.json',
      statusId: 'observed',
      ...overrides.artifactObservation,
    },
    checkoutObservation: {
      clean: true,
      sourceRevision: SOURCE_REVISION,
      statusId: 'observed',
      ...overrides.checkoutObservation,
    },
    executionPlanArtifact: artifact,
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    manifestObservations: overrides.manifestObservations || [{
      index: 0,
      path: MANIFEST_PATH,
      statusId: 'observed',
    }],
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    sideEffects: overrides.sideEffects,
  });
}

describe('policyCompatibilityDeletionPreflightEvidenceArtifact', () => {
  test('records only current machine-verifiable execution-gate observations', () => {
    const artifact = buildObservedEvidence();

    expect(artifact).toEqual(expect.objectContaining({
      statusId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED,
      artifactFingerprint: expect.objectContaining({
        algorithm: 'sha256',
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      executionPlanArtifact: expect.objectContaining({
        fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        manifestApproved: true,
        statusId: 'observed',
      }),
      checkout: expect.objectContaining({
        clean: true,
        sourceRevision: SOURCE_REVISION,
        statusId: 'observed',
      }),
      manifest: expect.objectContaining({
        statusId: 'observed',
      }),
      runtimeEvidence: expect.objectContaining({
        statusId: 'observed',
      }),
      sideEffects: {
        appEndpointInvoked: false,
        databaseRead: false,
        dockerInvoked: false,
        filesDeleted: false,
        storageChanged: false,
      },
      validation: expect.objectContaining({ ok: true }),
    }));
    expect(artifact).not.toHaveProperty('approval');
    expect(artifact).not.toHaveProperty('recovery');
    expect(artifact).not.toHaveProperty('stances');
  });

  test('reports a missing artifact and does not turn it into a ready claim', () => {
    const artifact = buildObservedEvidence({
      artifactObservation: { statusId: 'missing' },
      executionPlanArtifact: {},
      manifestObservations: [],
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.MISSING);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.ARTIFACT_MISSING,
      }),
    ]));
    expect(artifact.validation.ok).toBe(true);
  });

  test('reports stale approved artifact and runtime evidence references', () => {
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildReadyArtifact({
        generatedAt: '2026-07-14T19:54:59.999Z',
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .ARTIFACT_TIMESTAMP_STALE,
      }),
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .RUNTIME_EVIDENCE_STALE,
      }),
    ]));
  });

  test('fails closed when a manifest path is unsafe, missing, or no longer tracked', () => {
    const artifact = buildObservedEvidence({
      manifestObservations: [{
        index: 0,
        path: MANIFEST_PATH,
        statusId: 'invalid',
      }],
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
      }),
    ]));
  });

  test('does not let stale evidence mask an unsafe manifest-path observation', () => {
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildReadyArtifact({
        generatedAt: '2026-07-14T19:54:59.999Z',
      }),
      manifestObservations: [{
        index: 0,
        path: MANIFEST_PATH,
        statusId: 'invalid',
      }],
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
      }),
    ]));
  });

  test('fails closed for a dirty or unverifiable checkout', () => {
    const artifact = buildObservedEvidence({
      checkoutObservation: {
        clean: false,
        sourceRevision: SOURCE_REVISION,
        statusId: 'observed',
      },
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.CHECKOUT_NOT_CLEAN,
      }),
    ]));
  });

  test('fails closed when collection reports an unexpected side effect', () => {
    const artifact = buildObservedEvidence({
      sideEffects: { dockerInvoked: true },
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.sideEffects).toEqual(expect.objectContaining({ dockerInvoked: true }));
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
      }),
    ]));
    expect(artifact.validation.ok).toBe(false);
  });

  test('fails closed for an unrecognized reported side effect', () => {
    const artifact = buildObservedEvidence({
      sideEffects: { unexpectedNetworkProbe: true },
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.sideEffects).toEqual({
      appEndpointInvoked: false,
      databaseRead: false,
      dockerInvoked: false,
      filesDeleted: false,
      storageChanged: false,
    });
    expect(artifact.validation.ok).toBe(false);
    expect(artifact.validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.SIDE_EFFECT_REPORTED,
      }),
    ]));
  });

  test('rejects a serialized status that no longer matches its retained observations', () => {
    const artifact = buildObservedEvidence();
    artifact.statusId = POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID;

    const validation = validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.STATUS_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID,
      }),
    ]));
  });
});
