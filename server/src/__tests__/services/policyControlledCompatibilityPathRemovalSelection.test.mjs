/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS,
  evaluatePolicyControlledCompatibilityPathRemovalSelection,
  hasMeaningfulReplacementEvidence,
  isCanonicalRepositoryPath,
} from '../../services/policyControlledCompatibilityPathRemovalSelection.mjs';
import {
  POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS,
} from '../../services/policyCompatibilityDeletionExecutionActions.mjs';

const MANIFEST_PATH = 'server/src/services/policyIntentMapper.mjs';

function manifestEntry(overrides = {}) {
  return {
    categoryId: 'legacy_serializer_deserializer',
    path: MANIFEST_PATH,
    ready: true,
    replacementEvidence: {
      replacementPath: 'server/src/services/policyNativeIntentProjection.mjs',
    },
    ...overrides,
  };
}

describe('policyControlledCompatibilityPathRemovalSelection', () => {
  test('accepts only canonical repository-relative paths', () => {
    expect(isCanonicalRepositoryPath(MANIFEST_PATH)).toBe(true);
    expect(isCanonicalRepositoryPath(` ${MANIFEST_PATH}`)).toBe(false);
    expect(isCanonicalRepositoryPath(MANIFEST_PATH.replaceAll('/', '\\'))).toBe(false);
    expect(isCanonicalRepositoryPath('../outside-the-repository.mjs')).toBe(false);
    expect(isCanonicalRepositoryPath('/absolute/path.mjs')).toBe(false);
    expect(isCanonicalRepositoryPath('C:\\absolute\\path.mjs')).toBe(false);
  });

  test('accepts nested meaningful replacement evidence and rejects empty or cyclic values', () => {
    const cyclicEvidence = {};
    cyclicEvidence.self = cyclicEvidence;

    expect(hasMeaningfulReplacementEvidence({ checks: ['focused test'] })).toBe(true);
    expect(hasMeaningfulReplacementEvidence({ nested: { replacement: 'native path' } }))
      .toBe(true);
    expect(hasMeaningfulReplacementEvidence({})).toBe(false);
    expect(hasMeaningfulReplacementEvidence({ checks: [] })).toBe(false);
    expect(hasMeaningfulReplacementEvidence(cyclicEvidence)).toBe(false);
  });

  test('produces an exact approved selection with no risks', () => {
    const selection = evaluatePolicyControlledCompatibilityPathRemovalSelection({
      manifestEntries: [manifestEntry()],
      selectedPaths: [MANIFEST_PATH],
      maxBatchSize: 1,
    });

    expect(selection).toEqual(expect.objectContaining({
      manifestEntryCount: 1,
      requestedPathCount: 1,
      selectedPaths: [MANIFEST_PATH],
      missingPaths: [],
      risks: [],
    }));
    expect(selection.selectedEntries).toEqual([manifestEntry()]);
  });

  test('rejects duplicate approved paths, duplicate selection, and empty evidence', () => {
    const selection = evaluatePolicyControlledCompatibilityPathRemovalSelection({
      manifestEntries: [
        manifestEntry(),
        manifestEntry(),
      ],
      selectedPaths: [MANIFEST_PATH, MANIFEST_PATH],
      maxBatchSize: 2,
    });
    const emptyEvidenceSelection = evaluatePolicyControlledCompatibilityPathRemovalSelection({
      manifestEntries: [manifestEntry({ replacementEvidence: {} })],
      selectedPaths: [MANIFEST_PATH],
      maxBatchSize: 1,
    });

    expect(selection.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.MANIFEST_PATH_DUPLICATE,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS.SELECTED_PATH_DUPLICATE,
    ]));
    expect(emptyEvidenceSelection.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
          .SELECTED_ENTRY_REPLACEMENT_EVIDENCE_INVALID,
        path: MANIFEST_PATH,
      }),
    ]));
  });

  test('refuses named test scopes before they can become whole-file selections', () => {
    const selection = evaluatePolicyControlledCompatibilityPathRemovalSelection({
      manifestEntries: [manifestEntry({
        actionId: POLICY_COMPATIBILITY_DELETION_EXECUTION_ACTION_IDS.REMOVE_NAMED_TEST_SCOPE,
        sourceTextFragments: ["test('uses legacy bridge'"],
        testNameFragments: ['uses legacy bridge'],
        wholeFileDeletion: false,
      })],
      selectedPaths: [MANIFEST_PATH],
      maxBatchSize: 1,
    });

    expect(selection.manifestEntryCount).toBe(0);
    expect(selection.selectedEntries).toEqual([]);
    expect(selection.risks.map(risk => risk.riskId)).toEqual(expect.arrayContaining([
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
        .MANIFEST_ENTRY_SCOPE_UNSUPPORTED,
      POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_SELECTION_RISK_IDS
        .SELECTED_PATH_NOT_IN_MANIFEST,
    ]));
  });
});
