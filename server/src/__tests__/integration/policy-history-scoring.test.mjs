/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyPolicyHistoryScoringSql } from '../helpers/policyHistoryScoringSqlFixture.mjs';

test('history scoring isolates movie/TV identity before grouping and limiting in PostgreSQL', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyPolicyHistoryScoringSql(client)).toEqual({
      movieScore: 70, tvScore: 95, crossTypeDestinationScore: 0,
      beforeLimitScore: 70, deterministicLimit: true,
    });
  } finally {
    client.release();
  }
});
