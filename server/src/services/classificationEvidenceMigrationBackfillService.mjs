/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as defaultDatabase from '../config/database.mjs';
import { classificationEvidenceKeyBuilder } from './classificationEvidenceKeyBuilder.mjs';

export const CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE = 200;

export function transformExactMatchRow(row) {
  return {
    scope: 'item_exact',
    media_type: row.media_type || null,
    library_id: row.library_id || null,
    tmdb_id: row.tmdb_id || null,
    evidence_key: null,
    evidence_data: row.pattern_data || row.metadata || {},
    provenance: 'human_confirmed',
    confidence: row.confidence ?? 100,
    usage_count: row.usage_count ?? 0,
    success_rate: row.success_rate ?? null,
    status: 'active',
    created_by: row.created_by || null,
    source_system: 'learning_patterns'
  };
}

export function transformGenrePatternRow(row) {
  const genre = row.pattern_data?.genre || null;
  return {
    scope: 'genre',
    media_type: row.media_type || null,
    library_id: row.library_id || null,
    tmdb_id: null,
    evidence_key: genre ? classificationEvidenceKeyBuilder.buildSingleGenreKey(genre) : null,
    evidence_data: row.pattern_data || {},
    provenance: 'policy_confirmed',
    confidence: row.confidence ?? 0,
    usage_count: row.usage_count ?? 0,
    success_rate: row.success_rate ?? null,
    status: 'active',
    created_by: row.created_by || null,
    source_system: 'learning_patterns'
  };
}

export function transformDiscoveredPatternRow(row) {
  const scope = row.pattern_type || null;
  const value = row.pattern_value || null;
  return {
    scope,
    media_type: null,
    library_id: row.library_id || null,
    tmdb_id: null,
    evidence_key: scope && value ? classificationEvidenceKeyBuilder.buildForScope(scope, value) : null,
    evidence_data: {
      patternType: row.pattern_type || null,
      patternValue: row.pattern_value || null,
      sampleSize: row.sample_size ?? 0,
      supportCount: row.support_count ?? 0,
      autoApproved: row.auto_approved ?? false
    },
    provenance: 'mined',
    confidence: row.confidence ?? 0,
    usage_count: row.sample_size ?? 0,
    success_rate: null,
    status: (row.status === 'approved' || row.auto_approved) ? 'active' : 'candidate',
    created_by: row.approved_by || null,
    source_system: 'discovered_patterns'
  };
}

async function insertBatch(client, rows, dryRun) {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  if (dryRun) {
    return { inserted: rows.length, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const result = await client.query(
      `INSERT INTO classification_evidence
         (scope, media_type, library_id, tmdb_id, evidence_key, evidence_data,
          provenance, confidence, usage_count, success_rate, status,
          created_by, source_system)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT DO NOTHING`,
      [
        row.scope,
        row.media_type,
        row.library_id,
        row.tmdb_id,
        row.evidence_key,
        row.evidence_data ? JSON.stringify(row.evidence_data) : null,
        row.provenance,
        row.confidence,
        row.usage_count,
        row.success_rate,
        row.status,
        row.created_by,
        row.source_system
      ]
    );
    if ((result.rowCount || 0) > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

export async function run({ database = defaultDatabase, dryRun = false } = {}) {
  const summary = {
    dryRun,
    learning_patterns: { processed: 0, inserted: 0, skipped: 0 },
    discovered_patterns: { processed: 0, inserted: 0, skipped: 0 },
    errors: []
  };

  async function runWork(client) {
    const lpResult = await client.query(
      `SELECT id, tmdb_id, media_type, library_id, pattern_type,
              pattern_data, confidence, usage_count, success_rate,
              metadata, created_by
       FROM learning_patterns
       WHERE pattern_type IN ('exact_match', 'genre_pattern')
       ORDER BY id`
    );

    const lpRows = lpResult.rows;
    summary.learning_patterns.processed = lpRows.length;

    for (let i = 0; i < lpRows.length; i += CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE) {
      const batch = lpRows.slice(i, i + CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE);
      const payloads = batch.map((row) => {
        if (row.pattern_type === 'exact_match') return transformExactMatchRow(row);
        if (row.pattern_type === 'genre_pattern') return transformGenrePatternRow(row);
        return null;
      }).filter(Boolean);

      const { inserted, skipped } = await insertBatch(client, payloads, dryRun);
      summary.learning_patterns.inserted += inserted;
      summary.learning_patterns.skipped += skipped;
    }

    const tableExists = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'discovered_patterns'
       )`
    );

    if (tableExists.rows[0]?.exists) {
      const dpResult = await client.query(
        `SELECT id, pattern_type, pattern_value, library_id,
                confidence, sample_size, support_count, status,
                auto_approved, approved_by
         FROM discovered_patterns
         WHERE pattern_type IN ('studio','franchise','genre','certification')
           AND deprecated_at IS NULL
         ORDER BY id`
      );

      const dpRows = dpResult.rows;
      summary.discovered_patterns.processed = dpRows.length;

      for (let i = 0; i < dpRows.length; i += CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE) {
        const batch = dpRows.slice(i, i + CLASSIFICATION_EVIDENCE_BACKFILL_BATCH_SIZE);
        const payloads = batch.map((row) => transformDiscoveredPatternRow(row));

        const { inserted, skipped } = await insertBatch(client, payloads, dryRun);
        summary.discovered_patterns.inserted += inserted;
        summary.discovered_patterns.skipped += skipped;
      }
    }
  }

  try {
    if (dryRun) {
      await runWork(database);
    } else {
      await database.withTransaction((client) => runWork(client));
    }
  } catch (err) {
    summary.errors.push(err.message);
    throw err;
  }

  return summary;
}

