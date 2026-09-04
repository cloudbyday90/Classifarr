/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyQueueClassificationHistorySql } from '../helpers/queueClassificationHistorySqlFixture.mjs';

test('source history preserves typed identity through duplicate checks and insertion in PostgreSQL', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyQueueClassificationHistorySql(client)).toEqual({
      typedIdRows: 3, typedTitleRows: 3, rejectedInputs: 6, graphPreserved: true,
    });
  } finally {
    client.release();
  }
});
