-- Isolated shadow embeddings. No media content or routing authority is stored.
CREATE TABLE IF NOT EXISTS inventory_description_vector_cache (
    projection_version text NOT NULL CHECK (char_length(projection_version) BETWEEN 1 AND 100),
    model_name text NOT NULL CHECK (char_length(model_name) BETWEEN 1 AND 207),
    model_digest text NOT NULL CHECK (model_digest ~ '^[a-f0-9]{64}$'),
    dimensions integer NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
    description_hash text NOT NULL CHECK (description_hash ~ '^[a-f0-9]{64}$'),
    embedding vector NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (projection_version, model_name, model_digest, dimensions, description_hash),
    CHECK (vector_dims(embedding) = dimensions AND vector_norm(embedding) > 0)
);
CREATE INDEX IF NOT EXISTS idx_inventory_description_vector_cache_created
    ON inventory_description_vector_cache (created_at);
COMMENT ON TABLE inventory_description_vector_cache IS
    'Local Ollama shadow cache only; current inventory determines membership. No live routing consumer.';
