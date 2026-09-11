/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readHeldOutSemanticStudyInventoryFrame } from './heldOutSemanticStudyInventorySource.mjs';
import { heldOutSemanticStudyInventoryCandidate } from './heldOutSemanticStudyInventoryCandidate.mjs';
import { INVENTORY_SEMANTIC_SAMPLE_SQL, inventorySemanticSampleParameters } from './inventorySemanticSampleQuery.mjs';
import { buildInventorySemanticSampleReport } from './inventorySemanticSampleReport.mjs';

export const DEFAULT_INVENTORY_SAMPLE_SEED = 'classifarr-inventory-semantic-v1';

export function validateInventorySampleOptions({ seed = DEFAULT_INVENTORY_SAMPLE_SEED, size = 24 } = {}) {
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(seed) ||
      !Number.isInteger(size) || size < 1 || size > 32) {
    throw new Error('invalid_inventory_semantic_sample_options');
  }
  return { seed, size };
}

function assembleCase(item, rows) {
  const libraries = new Map();
  for (const row of rows) {
    if (!libraries.has(row.library_id)) {
      libraries.set(row.library_id, {
        id: row.library_id, name: row.library_name,
        observedMembership: row.observed_membership === true, neighbors: [],
      });
    }
    if (row.tmdb_id == null) continue;
    const similarity = Number(row.similarity);
    if (!Number.isFinite(similarity) || similarity < -1.000001 || similarity > 1.000001) {
      throw new Error('invalid_inventory_neighbor_similarity');
    }
    libraries.get(row.library_id).neighbors.push({
      item: heldOutSemanticStudyInventoryCandidate({
        media_type: item.metadata.media_type, tmdb_id: row.tmdb_id, title: row.title,
        year: row.year, genres: row.genres, metadata: { summary: row.overview },
        study_stratum: row.genres?.includes('Reality') ? 'reality'
          : row.genres?.includes('Documentary') ? 'documentary'
            : row.genres?.length >= 2 ? 'genre-overlap' : 'ordinary',
      }),
      similarity: Math.max(-1, Math.min(1, similarity)),
      hasAuthorizedOutcome: row.has_authorized_outcome === true,
    });
  }
  return {
    item, libraries: [...libraries.values()],
    hasStoredEmbedding: rows.some(row => row.query_embedding_available === true),
    representation: rows.length ? {
      provider: rows[0].embedding_provider,
      model: rows[0].embedding_model,
      dimensions: rows[0].embedding_dimensions,
    } : null,
  };
}

/**
 * Evaluation only. Cases contain private metadata for in-process consumers;
 * never serialize them. Only `report` may be printed or stored. No default DB
 * or inference singleton is imported; the caller owns the transaction runtime.
 */
export function createInventorySemanticSampler({ withTransaction }) {
  if (typeof withTransaction !== 'function') throw new Error('inventory_sample_transaction_required');
  return {
    async sample(options = {}) {
      const { seed, size } = validateInventorySampleOptions(options);
      return withTransaction(async client => {
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
        await client.query("SET LOCAL statement_timeout = '15s'");
        await client.query("SET LOCAL lock_timeout = '2s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '20s'");
        await client.query("SET LOCAL transaction_timeout = '90s'");
        const query = client.query.bind(client);
        const { rows: libraries } = await query(
          'SELECT id FROM libraries WHERE is_active = true ORDER BY id LIMIT 65',
        );
        if (libraries.length > 64) throw new Error('inventory_sample_library_limit_exceeded');
        const frame = await readHeldOutSemanticStudyInventoryFrame({
          query, selectionSeed: seed, perStratum: 24, libraryIds: libraries.map(library => library.id),
        });
        const cohort = frame.slice(0, size);
        const cases = [];
        for (const item of cohort) {
          const { rows } = await query(
            INVENTORY_SEMANTIC_SAMPLE_SQL, inventorySemanticSampleParameters(item, cohort, libraries),
          );
          cases.push(assembleCase(item, rows));
        }
        return { cases, report: buildInventorySemanticSampleReport(cases, { requested: size, libraryCount: libraries.length }) };
      });
    },
  };
}
