/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, test } from '@jest/globals';
import {
  buildLibraryPolicyPurposeProvenance,
  indexLibraryPolicyPurposeProvenance,
} from '../services/libraryPolicyPurposeProvenance.mjs';

describe('library policy-purpose provenance', () => {
  test.each([
    [{}, 'no_active_validated_native_policy'],
    [{ active_validated_policy_count: 2, profile_only_specialized_purpose_policy_count: 2 }, 'profile_only_specialized_purpose'],
    [{ active_validated_policy_count: 2, profile_only_specialized_purpose_policy_count: 1 }, 'no_retained_declared_purpose'],
    [{ active_validated_policy_count: 2, retained_declared_purpose_policy_count: 1 }, 'retained_declared_purpose_available'],
  ])('reduces aggregate record to %s safely', (record, statusId) => {
    expect(buildLibraryPolicyPurposeProvenance(record).statusId).toBe(statusId);
  });

  test('fills a bounded selected-library index without preserving private records', () => {
    const index = indexLibraryPolicyPurposeProvenance({
      libraryIds: [1, 2, 2, 0, '3'],
      records: [{ library_id: 1, active_validated_policy_count: 1, retained_declared_purpose_policy_count: 1, secret: 'no' }],
    });

    expect([...index.keys()]).toEqual([1, 2]);
    expect(index.get(1).statusId).toBe('retained_declared_purpose_available');
    expect(index.get(2).statusId).toBe('no_active_validated_native_policy');
    expect(JSON.stringify([...index.values()])).not.toContain('secret');
  });
});
