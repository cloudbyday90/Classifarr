/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyQueueEnrichmentIdentitySql } from '../helpers/queueEnrichmentIdentitySqlFixture.mjs';

test('queue refill through provider resolution and history preserves source media identity in PostgreSQL', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyQueueEnrichmentIdentitySql(client)).toEqual({
      typedHistoryRows: 2, sourceTypePreserved: true, staleTaskSkipped: true, guardedBackfills: true,
    });
  } finally {
    client.release();
  }
});
