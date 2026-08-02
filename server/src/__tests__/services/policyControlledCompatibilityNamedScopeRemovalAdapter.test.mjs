/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';
import {
  buildPolicyCompatibilityDeletionExecutionGate,
} from '../../services/policyCompatibilityDeletionExecutionGate.mjs';
import {
  buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity,
} from '../../services/policyCompatibilityDeletionPreflightManifestObservationIdentity.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS,
} from '../../services/policyCompatibilityDeletionPreApplyChangeDetector.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS,
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS,
  buildPolicyControlledCompatibilityNamedScopeRemovalDryRun,
  createPolicyControlledCompatibilityNamedScopeRemovalAdapter,
} from '../../services/policyControlledCompatibilityNamedScopeRemovalAdapter.mjs';
import {
  POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS,
  derivePolicyControlledCompatibilityNamedScopeSourceEdit,
} from '../../services/policyControlledCompatibilityNamedScopeSourceEdit.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
  buildReadyExecutionGateOperatorEvidence,
  buildReadyExecutionGatePreflightEvidenceArtifact,
  buildReadyExecutionGateRecoveryEvidence,
  buildReadyExecutionPlanArtifact,
} from './fixtures/policyCompatibilityDeletionExecutionGateFixtures.mjs';

function namedScopeEntry(overrides = {}) {
  return {
    actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
    categoryId: 'compatibility_named_test_scopes',
    componentPath: 'client/src/components/policies/PolicyIntentEditor.vue',
    deletionIntent: 'Remove explicitly retired compatibility assertions from a retained test file.',
    dependencyIds: ['compatibility_named_scope_fixture'],
    path: 'client/src/__tests__/retained-policy.test.js',
    ready: true,
    replacementEvidence: { replacement: 'Native destination test coverage is retained.' },
    sourceTextFragments: ['legacy alpha marker', 'legacy beta marker'],
    targetKindId: 'named_test_scope',
    testNameFragments: ['removes legacy alpha', 'removes legacy beta'],
    wholeFileDeletion: false,
    ...overrides,
  };
}

function namedScopeExecutionPlan(entry) {
  return {
    statusId: 'ready_for_execution_gate',
    readyForExecutionGate: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    manifest: {
      approved: true,
      approvedBy: 'policy-maintainer',
      entries: [entry],
    },
  };
}

function buildReadyGate(entry, overrides = {}) {
  const executionPlanArtifact = buildReadyExecutionPlanArtifact({
    executionPlan: namedScopeExecutionPlan(entry),
  });

  return buildPolicyCompatibilityDeletionExecutionGate({
    executionPlanArtifact,
    recoveryEvidence: buildReadyExecutionGateRecoveryEvidence({ executionPlanArtifact }),
    operatorEvidence: buildReadyExecutionGateOperatorEvidence({ executionPlanArtifact }),
    preflightEvidenceArtifact: buildReadyExecutionGatePreflightEvidenceArtifact({
      executionPlanArtifact,
    }),
    generatedAt: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
    ...overrides,
  });
}

function readyPreApplyVerification() {
  return {
    statusId: POLICY_COMPATIBILITY_DELETION_PRE_APPLY_CHANGE_DETECTOR_STATUS_IDS.VERIFIED,
    verified: true,
    validation: { ok: true, issueCount: 0, issues: [] },
    risks: [],
  };
}

describe('policyControlledCompatibilityNamedScopeRemovalAdapter', () => {
  let fixtureRoot;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-named-scope-removal-'));
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { force: true, recursive: true });
  });

  test('derives bounded dry-run edits from exact named-test identity without writing source', () => {
    const entry = namedScopeEntry();
    const gate = buildReadyGate(entry);
    const sourcePath = path.join(fixtureRoot, entry.path);
    const sourceText = [
      "import { describe, expect, it } from 'vitest';",
      '',
      "describe('retained policy behavior', () => {",
      "  it('removes legacy alpha', () => {",
      "    expect('legacy alpha marker').toBe('legacy alpha marker');",
      '  });',
      '',
      "  it('keeps native behavior', () => {",
      "    expect('native').toBe('native');",
      '  });',
      '',
      "  it('removes legacy beta', () => {",
      "    expect('legacy beta marker').toBe('legacy beta marker');",
      '  });',
      '});',
      '',
      '// scope-adapter-secret-must-not-be-output',
    ].join('\n');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, sourceText);
    const entryIdentity =
      buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry);
    let recheckCount = 0;
    const adapter = createPolicyControlledCompatibilityNamedScopeRemovalAdapter({
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: () => {
        recheckCount += 1;
        return readyPreApplyVerification();
      },
      repoRoot: fixtureRoot,
    });

    const dryRun = adapter.buildDryRun({
      executionGate: gate,
      selectedEntryIdentity: entryIdentity,
    });

    expect(dryRun.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
        .READY_FOR_SCOPE_REMOVAL_REVIEW
    );
    expect(dryRun.readyForScopeRemovalReview).toBe(true);
    expect(dryRun.validation.ok).toBe(true);
    expect(dryRun.dryRun).toEqual(expect.objectContaining({
      editCount: 2,
      operationId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      resultFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(dryRun.dryRun.edits.map(edit => edit.testName)).toEqual([
      'removes legacy alpha',
      'removes legacy beta',
    ]);
    expect(dryRun.selectedScope.wholeFileDeletion).toBe(false);
    expect(dryRun.sideEffects).toEqual(expect.objectContaining({
      filesDeleted: false,
      sourceWritten: false,
      storageChanged: false,
    }));
    expect(recheckCount).toBe(2);
    expect(fs.readFileSync(sourcePath, 'utf8')).toBe(sourceText);
    expect(JSON.stringify(dryRun)).not.toContain('scope-adapter-secret-must-not-be-output');
  });

  test('fails closed when an approved test name maps to multiple retained declarations', () => {
    const entry = namedScopeEntry({
      sourceTextFragments: ['legacy alpha marker'],
      testNameFragments: ['removes legacy alpha'],
    });
    const sourcePath = path.join(fixtureRoot, entry.path);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, [
      "it('removes legacy alpha', () => { expect('legacy alpha marker').toBeTruthy(); });",
      "it('removes legacy alpha', () => { expect('legacy alpha marker').toBeTruthy(); });",
    ].join('\n'));

    const dryRun = buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: buildReadyGate(entry),
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
      selectedEntryIdentity:
        buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    });

    expect(dryRun.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS.BLOCKED_BY_SOURCE
    );
    expect(dryRun.dryRun).toBeNull();
    expect(dryRun.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.TEST_NAME_AMBIGUOUS,
      }),
    ]));
  });

  test('fails closed when a source fragment changed after the named scope was approved', () => {
    const entry = namedScopeEntry({
      sourceTextFragments: ['legacy alpha marker'],
      testNameFragments: ['removes legacy alpha'],
    });
    const sourcePath = path.join(fixtureRoot, entry.path);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, [
      "it('removes legacy alpha', () => {",
      "  expect('changed marker').toBeTruthy();",
      '});',
    ].join('\n'));

    const dryRun = buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: buildReadyGate(entry),
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
      selectedEntryIdentity:
        buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    });

    expect(dryRun.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId:
          POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_SOURCE_EDIT_RISK_IDS.SOURCE_FRAGMENT_MISSING,
      }),
    ]));
  });

  test('refuses an identity that is not an exact observed named scope', () => {
    const entry = namedScopeEntry();
    const sourcePath = path.join(fixtureRoot, entry.path);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "it('removes legacy alpha', () => {});\nit('removes legacy beta', () => {});\nlegacy alpha marker\nlegacy beta marker\n");

    const dryRun = buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: buildReadyGate(entry),
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
      selectedEntryIdentity: 'named_test_scope:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(dryRun.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
        .BLOCKED_BY_SCOPE_IDENTITY
    );
    expect(dryRun.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
          .SELECTED_ENTRY_IDENTITY_MISSING,
      }),
    ]));
  });

  test('does not read the retained source when the required checkout recheck fails', () => {
    const entry = namedScopeEntry();
    const sourcePath = path.join(fixtureRoot, entry.path);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, 'scope-adapter-source-must-not-be-read');
    let recheckCount = 0;

    const dryRun = buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: buildReadyGate(entry),
      now: POLICY_COMPATIBILITY_DELETION_EXECUTION_GATE_TEST_TIME,
      preApplyChangeDetector: () => {
        recheckCount += 1;
        return {
          statusId: 'blocked',
          verified: false,
          validation: { ok: true, issueCount: 0, issues: [] },
          risks: [{ riskId: 'checkout_revision_changed' }],
        };
      },
      repoRoot: fixtureRoot,
      selectedEntryIdentity:
        buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    });

    expect(dryRun.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS
        .BLOCKED_BY_PREFLIGHT_RECHECK
    );
    expect(dryRun.dryRun).toBeNull();
    expect(recheckCount).toBe(1);
    expect(JSON.stringify(dryRun)).not.toContain('scope-adapter-source-must-not-be-read');
  });

  test('rejects a stale gate at dry-run time even when its serialized state was previously ready', () => {
    const entry = namedScopeEntry();
    const sourcePath = path.join(fixtureRoot, entry.path);
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "it('removes legacy alpha', () => {});\nit('removes legacy beta', () => {});\nlegacy alpha marker\nlegacy beta marker\n");

    const dryRun = buildPolicyControlledCompatibilityNamedScopeRemovalDryRun({
      executionGate: buildReadyGate(entry),
      now: '2026-07-16T20:00:00.000Z',
      preApplyChangeDetector: readyPreApplyVerification,
      repoRoot: fixtureRoot,
      selectedEntryIdentity:
        buildPolicyCompatibilityDeletionPreflightManifestObservationIdentity(entry),
    });

    expect(dryRun.statusId).toBe(
      POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_STATUS_IDS.BLOCKED_BY_EXECUTION_GATE
    );
    expect(dryRun.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_NAMED_SCOPE_REMOVAL_ADAPTER_RISK_IDS
          .EXECUTION_GATE_REVALIDATION_NOT_READY,
      }),
    ]));
  });

  test('derives safe declaration ranges without treating comments or strings as test declarations', () => {
    const sourceEdit = derivePolicyControlledCompatibilityNamedScopeSourceEdit({
      sourceText: [
        "const misleading = `it('retire this', () => {})`;",
        "// it('retire this', () => {})",
        "it('retire this', () => { expect(/test\)/).toBeTruthy(); });",
      ].join('\n'),
      sourceTextFragments: ['retire this'],
      testNameFragments: ['retire this'],
    });

    expect(sourceEdit.ready).toBe(true);
    expect(sourceEdit.dryRun.edits).toHaveLength(1);
    expect(sourceEdit.dryRun.edits[0]).toEqual(expect.objectContaining({
      testName: 'retire this',
    }));
  });
});
