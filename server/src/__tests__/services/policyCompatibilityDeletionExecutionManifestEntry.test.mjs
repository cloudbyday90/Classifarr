/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionPlan.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS,
  POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS,
  normalizePolicyCompatibilityDeletionExecutionManifestEntry,
  validatePolicyCompatibilityDeletionExecutionManifestEntry,
} from '../../services/policyCompatibilityDeletionExecutionManifestEntry.mjs';

const NAMED_SCOPE_ENTRY = {
  actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
  categoryId: 'stale_compatibility_tests',
  path: 'client/src/__tests__/PolicyCompatibilityMaintenanceSurface.test.js',
  sourceTextFragments: [
    "import PolicyPresetMigrationNotice from '../components/policies/PolicyPresetMigrationNotice.vue';",
  ],
  testNameFragments: [
    'renders the preset migration notice',
  ],
  wholeFileDeletion: false,
};

describe('policyCompatibilityDeletionExecutionManifestEntry', () => {
  test('normalizes an exact named test scope while preserving its no-file-deletion boundary', () => {
    const entry = normalizePolicyCompatibilityDeletionExecutionManifestEntry({
      ...NAMED_SCOPE_ENTRY,
      sourceTextFragments: [
        ...NAMED_SCOPE_ENTRY.sourceTextFragments,
        NAMED_SCOPE_ENTRY.sourceTextFragments[0],
      ],
    });

    expect(entry).toEqual(expect.objectContaining({
      kindId: POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS.NAMED_TEST_SCOPE,
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
      wholeFileDeletion: false,
      sourceTextFragments: NAMED_SCOPE_ENTRY.sourceTextFragments,
      testNameFragments: NAMED_SCOPE_ENTRY.testNameFragments,
    }));
    expect(validatePolicyCompatibilityDeletionExecutionManifestEntry(entry)).toEqual(
      expect.objectContaining({ ok: true, issueCount: 0 }),
    );
  });

  test('rejects scope entries that could become a whole-file deletion or lack exact identity', () => {
    const validation = validatePolicyCompatibilityDeletionExecutionManifestEntry({
      ...NAMED_SCOPE_ENTRY,
      sourceTextFragments: [],
      testNameFragments: [],
      wholeFileDeletion: true,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues.map(issue => issue.riskId)).toEqual(expect.arrayContaining([
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.SOURCE_FRAGMENT_MISSING,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS.TEST_NAME_FRAGMENT_MISSING,
      POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS
        .WHOLE_FILE_DELETION_ALLOWED,
    ]));
  });

  test('requires an explicit false whole-file-deletion boundary', () => {
    const scopeEntry = { ...NAMED_SCOPE_ENTRY };
    delete scopeEntry.wholeFileDeletion;

    const validation = validatePolicyCompatibilityDeletionExecutionManifestEntry(scopeEntry);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS
          .WHOLE_FILE_DELETION_ALLOWED,
      }),
    ]));
  });

  test('rejects scope metadata on a file-level action', () => {
    const validation = validatePolicyCompatibilityDeletionExecutionManifestEntry({
      ...NAMED_SCOPE_ENTRY,
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_TEST,
    });

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_RISK_IDS
          .FILE_ENTRY_SCOPE_PRESENT,
      }),
    ]));
  });

  test('retains source-backed target identity for file-level actions without treating it as a named test scope', () => {
    const entry = normalizePolicyCompatibilityDeletionExecutionManifestEntry({
      actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REPLACE_CODE_PATH,
      categoryId: 'policy_builder_modal_legacy_branch',
      path: 'client/src/components/policies/PolicyBuilderModal.vue',
      targetKindId: 'code_path',
      dependencyIds: ['policy_builder_modal_legacy_branch'],
      sourceTextFragments: ['legacy compatibility branch'],
    });

    expect(entry).toEqual(expect.objectContaining({
      kindId: POLICY_COMPATIBILITY_DELETION_EXECUTION_MANIFEST_ENTRY_KIND_IDS.FILE_PATH,
      targetKindId: 'code_path',
      dependencyIds: ['policy_builder_modal_legacy_branch'],
      sourceTextFragments: ['legacy compatibility branch'],
      testNameFragments: [],
      wholeFileDeletion: null,
    }));
    expect(validatePolicyCompatibilityDeletionExecutionManifestEntry(entry)).toEqual(
      expect.objectContaining({ ok: true, issueCount: 0 }),
    );
  });
});
