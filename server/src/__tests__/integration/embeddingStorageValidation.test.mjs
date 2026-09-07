/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { getPool } from './setup.mjs';
import { verifyEmbeddingStorageContract } from '../fixtures/embeddingStorageContract.mjs';

test('preserves stored text, images, dimensions and indexes after rejected writes', async () => {
  const client = await getPool().connect();
  try { expect(await verifyEmbeddingStorageContract(client)).toMatchObject({ preservedRowsAndSchema: true }); }
  finally { client.release(); }
});
