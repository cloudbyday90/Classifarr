/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  loadHeldOutSemanticStudyLifecycleReauditSourceRecord,
} from '../../services/heldOutSemanticStudyLifecycleReauditSource.mjs';

test('reads only verified lifecycle receipt aggregates', async () => {
  const db = {
    query: jest.fn(async () => ({
      rows: [{
        normal_lifecycle_receipt_count: 3,
        initial_intent_establishment_count: 1,
        native_intent_change_count: 1,
        library_rebuild_replacement_count: 1,
      }],
    })),
  };

  await expect(loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db })).resolves.toEqual({
    normal_lifecycle_receipt_count: 3,
    initial_intent_establishment_count: 1,
    native_intent_change_count: 1,
    library_rebuild_replacement_count: 1,
  });

  const sql = db.query.mock.calls[0][0];
  expect(sql).toContain('normal_lifecycle_receipts AS');
  expect(sql).toContain('policy_migration_verification_runs');
  expect(sql).toContain("replacement_event.event_type = 'library_rebuild_replacement_applied'");
  expect(sql).toContain('normal_lifecycle_receipt_count');
  expect(sql).not.toContain('policy.name');
  expect(sql).not.toContain('library.name');
  expect(sql).not.toContain('rule.values');
  expect(sql).not.toContain('metadata');
  expect(sql).not.toContain('actor_id');
});
