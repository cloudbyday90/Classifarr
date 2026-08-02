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
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from '../../services/policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';

const SOURCE_REVISION = '0123456789abcdef0123456789abcdef01234567';
const MANIFEST_PATH = 'server/src/services/legacyCompatibilityBridge.mjs';
const SHARED_TEST_PATH = 'server/src/__tests__/services/policyLegacyCompatibility.test.mjs';

function namedScope(overrides = {}) {
  return {
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    categoryId: 'compatibility_named_test_scopes',
    componentPath: 'server/src/services/policyLegacyCompatibility.mjs',
    dependencyIds: ['policy_legacy_compatibility'],
    deletionIntent: 'Remove a legacy compatibility test without deleting its retained test file.',
    path: SHARED_TEST_PATH,
    sourceTextFragments: ["test('uses legacy bridge'"],
    targetKindId: 'named_test_scope',
    testNameFragments: ['uses legacy bridge'],
    wholeFileDeletion: false,
    ...overrides,
  };
}

function buildNamedScopeArtifact(entries = [namedScope()]) {
  return buildReadyExecutionPlanArtifact({
    executionPlan: {
      statusId: 'ready_for_execution_gate',
      readyForExecutionGate: true,
      validation: { ok: true, issueCount: 0, issues: [] },
      manifest: {
        approved: true,
        approvedBy: 'policy-maintainer',
        entries,
      },
    },
  });
}

function observeEntries(entries = []) {
  return entries.map((entry, index) => ({
    entryIdentity: buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    index,
    path: entry.path,
    statusId: 'observed',
  }));
}

function buildReadyArtifact({
  generatedAt = POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  overrides = {},
} = {}) {
  return buildReadyExecutionPlanArtifact({
    generatedAt,
    overrides,
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
      runtimeEvidenceEscalation: expect.objectContaining({
        statusId: 'retained_runtime_evidence_sufficient',
        runtimeProbeRequired: false,
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

  test('keeps distinct named scopes in one retained file as separate observations', () => {
    const entries = [
      namedScope(),
      namedScope({
        sourceTextFragments: ["test('preserves legacy fallback'"],
        testNameFragments: ['preserves legacy fallback'],
      }),
    ];
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildNamedScopeArtifact(entries),
      manifestObservations: observeEntries(entries),
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.OBSERVED);
    expect(artifact.manifest.entries).toHaveLength(2);
    expect(new Set(artifact.manifest.entries.map(entry => entry.entryIdentity)).size).toBe(2);
    expect(artifact.validation.ok).toBe(true);
  });

  test('requires an exact identity for every named-scope observation', () => {
    const entry = namedScope();
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildNamedScopeArtifact([entry]),
      manifestObservations: [{ index: 0, path: entry.path, statusId: 'observed' }],
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS.MANIFEST_INVALID,
      }),
    ]));
  });

  test('fails closed when the approved manifest repeats an exact named scope', () => {
    const entry = namedScope();
    const entries = [entry, { ...entry }];
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildNamedScopeArtifact(entries),
      manifestObservations: observeEntries(entries),
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.INVALID);
    expect(artifact.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .MANIFEST_DUPLICATE_ENTRY_IDENTITY,
      }),
    ]));
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

  test('requires a contained runtime probe only when otherwise-valid retained evidence is stale', () => {
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildReadyArtifact({
        overrides: {
          evidenceBundle: {
            generatedAt: '2026-07-14T19:54:59.999Z',
          },
        },
      }),
    });

    expect(artifact.statusId)
      .toBe(POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_STATUS_IDS.STALE);
    expect(artifact.runtimeEvidenceEscalation).toEqual(expect.objectContaining({
      statusId: 'embedded_runtime_probe_required',
      runtimeProbeRequired: true,
      nextStep: { stepId: 'collect_provenance_bound_runtime_evidence' },
    }));
    expect(artifact.nextStep.stepId).toBe('collect_provenance_bound_runtime_evidence');
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

  test('binds named-scope observation identity in the preflight artifact fingerprint', () => {
    const entry = namedScope();
    const artifact = buildObservedEvidence({
      executionPlanArtifact: buildNamedScopeArtifact([entry]),
      manifestObservations: observeEntries([entry]),
    });
    artifact.manifest.entries[0].entryIdentity = 'named_test_scope:'.concat('0'.repeat(64));

    const validation = validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID,
      }),
    ]));
  });

  test('rejects a serialized runtime escalation that no longer matches retained observations', () => {
    const artifact = buildObservedEvidence();
    artifact.runtimeEvidenceEscalation = {
      ...artifact.runtimeEvidenceEscalation,
      runtimeProbeRequired: true,
    };

    const validation = validatePolicyCompatibilityDeletionPreflightEvidenceArtifact(artifact);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .RUNTIME_EVIDENCE_ESCALATION_MISMATCH,
      }),
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_PREFLIGHT_EVIDENCE_RISK_IDS
          .PREFLIGHT_ARTIFACT_FINGERPRINT_INVALID,
      }),
    ]));
  });
});
