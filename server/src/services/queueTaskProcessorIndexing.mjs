export async function rebuildImageIndexes(task, { db, logger, completeTask }) {
    logger.info('Rebuilding deferred HNSW and B-tree image indexes...');
    await db.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hnsw
        ON classification_embeddings USING hnsw (image_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
    `);
    await db.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_present
        ON classification_embeddings (image_provider, image_model)
        WHERE image_embedding IS NOT NULL
    `);
    await db.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_embeddings_image_hash
        ON classification_embeddings (image_embedding_hash, image_model, image_embedding_size)
        WHERE image_embedding_hash IS NOT NULL
    `);
    logger.info('HNSW and supporting image indexes rebuilt successfully.');
    await completeTask(task.id, {
        rebuilt: true,
        indexes: [
            'idx_embeddings_image_hnsw',
            'idx_embeddings_image_present',
            'idx_embeddings_image_hash'
        ]
    });
}
