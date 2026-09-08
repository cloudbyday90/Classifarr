/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import {
  buildHeldOutSemanticStudyLifecycleReauditSource,
  heldOutSemanticStudyLifecycleReauditSourceFingerprint,
  isHeldOutSemanticStudyLifecycleReauditSourceChanged,
} from '../../services/heldOutSemanticStudyLifecycleReauditContract.mjs';

test('builds a fixed aggregate lifecycle receipt with no library or media identity', () => {
  const source = buildHeldOutSemanticStudyLifecycleReauditSource({
    normal_lifecycle_receipt_count: '6',
    initial_intent_establishment_count: '1',
    native_intent_change_count: '2',
    library_rebuild_replacement_count: '3',
  });

  expect(source).toEqual({
    version: 'policy.held_out_semantic_study_lifecycle_reaudit_source.v1',
    normalLifecycleReceiptCount: 6,
    lifecycleTransitionCounts: {
      initial_intent_establishment: 1,
      native_intent_change: 2,
      library_rebuild_replacement: 3,
    },
    rawConfigurationExposed: false,
    libraryIdentityExposed: false,
    mediaIdentityExposed: false,
  });
  expect(JSON.stringify(source)).not.toMatch(/library_id|policy_id|tmdb|metadata|rule_value/u);
});

test('detects only a normalized aggregate receipt change', () => {
  const source = buildHeldOutSemanticStudyLifecycleReauditSource({
    normal_lifecycle_receipt_count: 1,
    initial_intent_establishment_count: 1,
  });
  const sourceFingerprint = heldOutSemanticStudyLifecycleReauditSourceFingerprint(source);

  expect(isHeldOutSemanticStudyLifecycleReauditSourceChanged({
    source,
    state: { sourceFingerprint },
  })).toBe(false);
  expect(isHeldOutSemanticStudyLifecycleReauditSourceChanged({
    source: buildHeldOutSemanticStudyLifecycleReauditSource({
      normal_lifecycle_receipt_count: 2,
      initial_intent_establishment_count: 1,
      native_intent_change_count: 1,
    }),
    state: { sourceFingerprint },
  })).toBe(true);
});
