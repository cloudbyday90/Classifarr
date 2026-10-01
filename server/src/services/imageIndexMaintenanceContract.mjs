/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

export const IMAGE_INDEX_LOCK_KEY = 2026;
export const IMAGE_INDEX_BUDGET_MS = 120_000;

// Closed code-owned contract. Never derive identifiers or DDL from queue payloads.
export const IMAGE_INDEXES = Object.freeze([
  {
    name: 'idx_embeddings_image_hnsw', accessMethod: 'hnsw',
    columns: ['image_embedding'], opclasses: ['vector_cosine_ops'], predicate: null,
    options: ['ef_construction=64', 'm=16'],
    create: `CREATE INDEX CONCURRENTLY idx_embeddings_image_hnsw
      ON public.classification_embeddings USING hnsw (image_embedding public.vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)`,
    drop: 'DROP INDEX CONCURRENTLY public.idx_embeddings_image_hnsw',
  },
  {
    name: 'idx_embeddings_image_present', accessMethod: 'btree',
    columns: ['image_provider', 'image_model'], opclasses: ['text_ops', 'text_ops'],
    predicate: '(image_embedding IS NOT NULL)', options: [],
    create: `CREATE INDEX CONCURRENTLY idx_embeddings_image_present
      ON public.classification_embeddings (image_provider, image_model)
      WHERE image_embedding IS NOT NULL`,
    drop: 'DROP INDEX CONCURRENTLY public.idx_embeddings_image_present',
  },
  {
    name: 'idx_embeddings_image_hash', accessMethod: 'btree',
    columns: ['image_embedding_hash', 'image_model', 'image_embedding_size'],
    opclasses: ['text_ops', 'text_ops', 'int4_ops'],
    predicate: '(image_embedding_hash IS NOT NULL)', options: [],
    create: `CREATE INDEX CONCURRENTLY idx_embeddings_image_hash
      ON public.classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
      WHERE image_embedding_hash IS NOT NULL`,
    drop: 'DROP INDEX CONCURRENTLY public.idx_embeddings_image_hash',
  },
].map(value => Object.freeze({ ...value, columns: Object.freeze(value.columns),
  opclasses: Object.freeze(value.opclasses), options: Object.freeze(value.options) })));
