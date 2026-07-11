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
  MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS,
  buildPolicyEvidenceBoundedCollection,
  normalizeMaximumCollectionItems,
} from '../../services/policyEvidenceInputCardinality.mjs';

describe('policyEvidenceInputCardinality', () => {
  test('bounds collection inspection without retaining values outside the limit', () => {
    const collection = buildPolicyEvidenceBoundedCollection([
      'first',
      'second',
      'third',
    ], {
      maximumCollectionItems: 2,
    });

    expect(collection).toEqual({
      items: ['first', 'second'],
      itemCount: 3,
      maximumItems: 2,
      exceedsLimit: true,
    });
  });

  test('uses a fixed upper bound when callers supply invalid or oversized limits', () => {
    expect(normalizeMaximumCollectionItems(0))
      .toBe(MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS);
    expect(normalizeMaximumCollectionItems(MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS + 1))
      .toBe(MAX_POLICY_EVIDENCE_INPUT_COLLECTION_ITEMS);
  });
});
