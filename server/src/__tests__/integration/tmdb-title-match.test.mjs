/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyTmdbTitleMatchSql } from '../helpers/tmdbTitleMatchSqlFixture.mjs';

test('title resolution preserves unknown IDs and review receipts through PostgreSQL enrichment/history writes', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyTmdbTitleMatchSql(client)).toEqual({
      cases: 8, resolved: 2, reviewRequired: 6, knownIdClearsReview: true,
    });
  } finally {
    client.release();
  }
});
