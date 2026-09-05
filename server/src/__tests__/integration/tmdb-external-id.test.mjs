/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyTmdbExternalIdSql } from '../helpers/tmdbExternalIdSqlFixture.mjs';

test('external-ID uncertainty survives PostgreSQL metadata/history writes without title fallback', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyTmdbExternalIdSql(client)).toEqual({
      cases: 13, resolved: 4, reviewRequired: 9, uncertaintyBlocksTitle: true, knownIdClearsReview: true,
    });
  } finally {
    client.release();
  }
});
