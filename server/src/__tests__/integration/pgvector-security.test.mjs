/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { verifyPgvectorSecurityBoundary } from '../helpers/pgvectorSecurityProbe.mjs';

test('patched native indexes reject mismatched dimensions while legitimate queries work', async () => {
  const client = await getPool().connect();
  try {
    expect(await verifyPgvectorSecurityBoundary(client)).toEqual({
      indexBoundaries: 6, emptyAverage: true, nonfiniteRejected: true,
    });
  } finally {
    client.release();
  }
});
