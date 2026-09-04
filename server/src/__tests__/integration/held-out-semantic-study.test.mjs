/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyHeldOutSemanticStudySql } from '../helpers/heldOutSemanticStudySqlFixture.mjs';

test('held-out queries exclude every cohort identity before limits in real pgvector', async () => {
  const client = await getPool().connect();
  try {
    const before = (await client.query('SHOW enable_indexscan')).rows[0].enable_indexscan;
    expect(await verifyHeldOutSemanticStudySql(client)).toEqual({
      currentInventoryBeforeLimit: true, duplicateEmbeddingsExcluded: true,
      fullCohortExcluded: true, pairedMediaIdentity: true, legitimateNeighborsRetained: true,
    });
    expect((await client.query('SHOW enable_indexscan')).rows[0].enable_indexscan).toBe(before);
  } finally {
    client.release();
  }
});
