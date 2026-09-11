/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { validateEmbedding } from '../utils/embeddingValidation.mjs';
import { canonicalStudyModel } from './localStudyEmbeddingClient.mjs';
import { INVENTORY_DESCRIPTION_PROJECTION_VERSION } from './inventoryDescriptionProjection.mjs';

export function validateDescriptionRepresentation(value) {
  if (value?.provider !== 'ollama' || canonicalStudyModel(value.model) !== value.model ||
      !/^[a-f0-9]{64}$/.test(value.digest ?? '') || !Number.isInteger(value.dimensions) ||
      value.dimensions < 1 || value.dimensions > 16000) throw new Error('inventory_description_representation_invalid');
  return [INVENTORY_DESCRIPTION_PROJECTION_VERSION, value.model, value.digest, value.dimensions];
}

function validateHashes(hashes, maximum) {
  if (!Array.isArray(hashes) || hashes.length > maximum || new Set(hashes).size !== hashes.length ||
      hashes.some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('inventory_description_hashes_invalid');
}

/** Immutable representation/content keys; no plaintext or inventory membership. */
export function createInventoryDescriptionVectorCache({ query }) {
  return {
    async findPresent(representation, hashes) {
      const parameters = validateDescriptionRepresentation(representation);
      validateHashes(hashes, 10000);
      if (!hashes.length) return new Set();
      const { rows } = await query(`SELECT description_hash FROM inventory_description_vector_cache
        WHERE projection_version=$1 AND model_name=$2 AND model_digest=$3 AND dimensions=$4
          AND description_hash=ANY($5::text[]) AND created_at > now() - interval '30 days'`, [...parameters, hashes]);
      const requested = new Set(hashes);
      const present = new Set();
      for (const row of rows) {
        if (!requested.has(row.description_hash) || present.has(row.description_hash)) throw new Error('inventory_description_cache_scope_invalid');
        present.add(row.description_hash);
      }
      return present;
    },
    async read(representation, hashes) {
      const parameters = validateDescriptionRepresentation(representation);
      validateHashes(hashes, 10000);
      const vectors = new Map();
      for (let offset = 0; offset < hashes.length; offset += 256) {
        const requested = hashes.slice(offset, offset + 256);
        const { rows } = await query(`SELECT description_hash, embedding::text AS embedding
          FROM inventory_description_vector_cache
          WHERE projection_version=$1 AND model_name=$2 AND model_digest=$3 AND dimensions=$4
            AND description_hash=ANY($5::text[]) AND created_at > now() - interval '30 days'`, [...parameters, requested]);
        for (const row of rows) {
          if (!requested.includes(row.description_hash) || vectors.has(row.description_hash)) throw new Error('inventory_description_cache_scope_invalid');
          vectors.set(row.description_hash, validateEmbedding(JSON.parse(row.embedding), representation.dimensions));
        }
      }
      return vectors;
    },
    async write(representation, entries) {
      const parameters = validateDescriptionRepresentation(representation);
      if (!Array.isArray(entries)) throw new Error('inventory_description_cache_entries_invalid');
      validateHashes(entries.map(entry => entry.hash), 8);
      if (!entries.length) return;
      const encoded = entries.map(entry => ({ hash: entry.hash, vector: JSON.stringify(validateEmbedding(entry.vector, representation.dimensions)) }));
      await query(`INSERT INTO inventory_description_vector_cache
        (projection_version, model_name, model_digest, dimensions, description_hash, embedding)
        SELECT $1,$2,$3,$4,e.hash,e.vector::vector
        FROM jsonb_to_recordset($5::jsonb) e(hash text, vector text)
        ON CONFLICT (projection_version,model_name,model_digest,dimensions,description_hash)
        DO UPDATE SET embedding=EXCLUDED.embedding, created_at=now()
        WHERE inventory_description_vector_cache.created_at <= now() - interval '30 days'`, [...parameters, JSON.stringify(encoded)]);
    },
    async pruneExpired() {
      const { rowCount } = await query(`DELETE FROM inventory_description_vector_cache WHERE ctid IN (
        SELECT ctid FROM inventory_description_vector_cache
        WHERE created_at <= now() - interval '30 days' ORDER BY created_at LIMIT 1000
      )`);
      return rowCount;
    },
  };
}
