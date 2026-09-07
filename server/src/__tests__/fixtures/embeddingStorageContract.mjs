/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { storeEmbedding, storeImageEmbedding } from '../../services/embeddingServiceStorage.mjs';

/** A dedicated connection with temporary tables; rollback leaves no persistent writes. */
export async function verifyEmbeddingStorageContract(client) {
  let queries = 0, transactions = 0;
  const logger = { error() {} };
  const db = {
    query: (...args) => { queries++; return client.query(...args); },
    withTransaction: async () => { transactions++; throw new Error('Storage must not repair schema'); },
  };
  await client.query('BEGIN');
  try {
    await client.query(`CREATE TEMP TABLE classification_embeddings (
      id serial PRIMARY KEY, classification_id integer UNIQUE, embedding vector(3), embedding_dims integer,
      provider text, model text, is_stale boolean DEFAULT false, updated_at timestamptz,
      image_embedding vector(2), image_embedding_dims integer, image_provider text, image_model text,
      image_embedding_hash text, image_embedding_size integer, image_embedding_source_url text
    ) ON COMMIT DROP`);
    await client.query('CREATE INDEX fixture_embedding_hnsw ON classification_embeddings USING hnsw (embedding vector_cosine_ops)');
    const vector = { embedding: [0.1, 0.2, 0.3], dims: 3, provider: 'fixture', model: 'fixture' };
    assert.equal((await storeEmbedding({ db, logger }, 1, vector)).dims, 3);
    assert.equal((await storeImageEmbedding({ db, logger }, 1, { ...vector, embedding: [0.1, 0.2], dims: 2 })).dims, 2);
    const snapshot = async () => ({
      rows: (await client.query('SELECT * FROM pg_temp.classification_embeddings ORDER BY id')).rows,
      columns: (await client.query("SELECT attname,atttypmod FROM pg_attribute WHERE attrelid='pg_temp.classification_embeddings'::regclass ORDER BY attnum")).rows,
      indexes: (await client.query("SELECT indexrelid,indisvalid FROM pg_index WHERE indrelid='pg_temp.classification_embeddings'::regclass ORDER BY indexrelid")).rows,
    });
    const before = await snapshot();
    for (const kind of ['text', 'image']) {
      await client.query('SAVEPOINT storage_attempt');
      queries = 0;
      if (kind === 'text') await assert.rejects(storeEmbedding({ db, logger }, 1,
        { ...vector, embedding: [0.1, 0.2], dims: 2 }), { code: '22000' });
      else assert.equal(await storeImageEmbedding({ db, logger }, 1, vector), null);
      assert.equal(queries, 1);
      assert.equal(transactions, 0);
      await client.query('ROLLBACK TO SAVEPOINT storage_attempt');
      assert.deepEqual(await snapshot(), before);
    }
    queries = 0;
    const invalid = { ...vector, dims: '3); DROP TABLE classification_embeddings; --' };
    await assert.rejects(storeEmbedding({ db, logger }, 1, invalid), { code: 'INVALID_EMBEDDING' });
    assert.equal(await storeImageEmbedding({ db, logger }, 1, invalid), null);
    assert.equal(queries, 0);
    assert.deepEqual(await snapshot(), before);
    return { validWrites: 2, rejectedDimensionWrites: 2, rejectedInvalidWrites: 2, preservedRowsAndSchema: true };
  } finally {
    await client.query('ROLLBACK');
  }
}
