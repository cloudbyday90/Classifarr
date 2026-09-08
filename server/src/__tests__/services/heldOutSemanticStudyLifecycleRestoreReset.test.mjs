/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  resetHeldOutSemanticStudyLifecycleStateForRestore,
} from '../../services/heldOutSemanticStudyLifecycleRestoreReset.mjs';

test('removes only derived held-out lifecycle state during a restore', async () => {
  const client = { query: jest.fn(async () => ({ rows: [] })) };

  await resetHeldOutSemanticStudyLifecycleStateForRestore({ client });

  expect(client.query).toHaveBeenNthCalledWith(
    1,
    'DELETE FROM held_out_semantic_study_lifecycle_reaudit_state',
  );
  expect(client.query).toHaveBeenNthCalledWith(
    2,
    'DELETE FROM held_out_semantic_study_lifecycle_source_checkpoint',
  );
  expect(JSON.stringify(client.query.mock.calls)).not.toMatch(
    /policy_id|library_id|media|configuration|routing|label/i,
  );
});
