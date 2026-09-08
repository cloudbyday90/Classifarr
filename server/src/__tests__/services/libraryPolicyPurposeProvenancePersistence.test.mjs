/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, expect, jest, test } from '@jest/globals';
import {
  loadLibraryPolicyPurposeProvenanceRecords,
} from '../../services/libraryPolicyPurposeProvenancePersistence.mjs';

describe('libraryPolicyPurposeProvenancePersistence', () => {
  test('selects fixed per-library counts without policy rule values or inventory data', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ library_id: 1 }] });
    await expect(loadLibraryPolicyPurposeProvenanceRecords({ db: { query }, libraryIds: [1, 2] }))
      .resolves.toEqual([{ library_id: 1 }]);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WITH selected_libraries AS MATERIALIZED')
    expect(sql).toContain("intent.source = 'native_intent'")
    expect(sql).toContain('active_validated_policy_count')
    expect(sql).toContain('profile_only_specialized_purpose_policy_count')
    expect(sql).toContain('retained_declared_purpose_policy_count')
    expect(sql).toContain("rule.source = 'media_server_library_profile'")
    expect(sql).toContain("rule.inference_state = 'inferred'")
    expect(sql).not.toContain('rule.values')
    expect(sql).not.toContain('media_server_items')
    expect(sql).not.toContain('classification_history')
    expect(values).toEqual([[1, 2]])
  });

  test('does not query for an empty or invalid library selection', async () => {
    const query = jest.fn();
    await expect(loadLibraryPolicyPurposeProvenanceRecords({ db: { query }, libraryIds: [0, '1'] }))
      .resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
