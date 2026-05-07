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

import { resolve } from 'node:path';

const BACKFILL_SCOPE = 'backfill_classification_evidence';
const BATCH_SIZE = 200;
const DISCOVERED_PATTERN_SCOPES = new Set(['studio', 'franchise', 'genre', 'certification']);

function transformLearningPatternRow(row, keyBuilder) {
  if (row.pattern_type === 'exact_match') {
    return {
      scope: 'item_exact',
      tmdb_id: row.tmdb_id ?? null,
      media_type: row.media_type ?? null,
      library_id: row.library_id ?? null,
      evidence_key: null,
      evidence_data: row.pattern_data ?? row.metadata ?? null,
      provenance: 'human_confirmed',
      confidence: 100,
      usage_count: row.usage_count ?? 0,
      success_rate: row.success_rate ?? null,
      status: 'active',
      created_by: row.created_by ?? BACKFILL_SCOPE,
      source_system: 'learning_patterns'
    };
  }

  if (row.pattern_type === 'genre_pattern') {
    const genreRaw = row.pattern_data?.genre ?? null;
    if (!genreRaw) return null;
    const evidenceKey = keyBuilder.buildSingleGenreKey(genreRaw);
    return {
      scope: 'genre',
      tmdb_id: null,
      media_type: row.media_type ?? null,
      library_id: row.library_id ?? null,
      evidence_key: evidenceKey,
      evidence_data: row.pattern_data ?? null,
      provenance: 'policy_confirmed',
      confidence: row.confidence ?? 85,
      usage_count: row.usage_count ?? 0,
      success_rate: row.success_rate ?? null,
      status: 'active',
      created_by: row.created_by ?? BACKFILL_SCOPE,
      source_system: 'learning_patterns'
    };
  }

  return null;
}

function transformDiscoveredPatternRow(row, keyBuilder) {
  if (!DISCOVERED_PATTERN_SCOPES.has(row.pattern_type)) return null;
  if (row.status === 'rejected' || row.status === 'decayed') return null;

  const evidenceKey = keyBuilder.buildForScope(row.pattern_type, row.pattern_value);
  const status = (row.status === 'approved' || row.auto_approved) ? 'active' : 'candidate';

  return {
    scope: row.pattern_type,
    tmdb_id: null,
    media_type: null,
    library_id: row.library_id ?? null,
    evidence_key: evidenceKey,
    evidence_data: {
      patternValue: row.pattern_value,
      sampleSize: row.sample_size ?? null,
      supportCount: row.support_count ?? null,
      discoveredPatternId: row.id
    },
    provenance: 'mined',
    confidence: row.confidence ?? 0,
    usage_count: row.support_count ?? 0,
    success_rate: null,
    status,
    created_by: BACKFILL_SCOPE,
    source_system: 'discovered_patterns'
  };
}

async function upsertEvidenceRow(db, record) {
  let conflictClause;
  if (record.scope === 'item_exact' && record.tmdb_id != null) {
    conflictClause = `ON CONFLICT (scope, tmdb_id, media_type)
      WHERE scope = 'item_exact' AND tmdb_id IS NOT NULL
      DO NOTHING`;
  } else if (DISCOVERED_PATTERN_SCOPES.has(record.scope)) {
    conflictClause = `ON CONFLICT (scope, media_type, library_id, evidence_key)
      WHERE scope IN ('genre', 'studio', 'franchise', 'certification')
      DO NOTHING`;
  } else {
    conflictClause = '';
  }

  const result = await db.query(
    `INSERT INTO classification_evidence
       (scope, tmdb_id, media_type, library_id, evidence_key, evidence_data,
        confidence, usage_count, success_rate, provenance, status,
        created_by, source_system)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13)
     ${conflictClause}
     RETURNING id`,
    [
      record.scope,
      record.tmdb_id,
      record.media_type,
      record.library_id,
      record.evidence_key,
      record.evidence_data ? JSON.stringify(record.evidence_data) : null,
      record.confidence,
      record.usage_count,
      record.success_rate,
      record.provenance,
      record.status,
      record.created_by,
      record.source_system
    ]
  );
  return (result.rowCount ?? 0) > 0;
}

async function runBackfill({ db, keyBuilder, dryRun = false }) {
  const summary = {
    learningPatterns: { read: 0, inserted: 0, skipped: 0 },
    discoveredPatterns: { read: 0, inserted: 0, skipped: 0 },
    errors: []
  };

  const lpResult = await db.query(
    `SELECT id, tmdb_id, media_type, library_id, pattern_type,
            pattern_data, metadata, confidence, usage_count, success_rate, created_by
     FROM learning_patterns
     ORDER BY id`
  );

  for (let offset = 0; offset < lpResult.rows.length; offset += BATCH_SIZE) {
    const batch = lpResult.rows.slice(offset, offset + BATCH_SIZE);

    for (const row of batch) {
      summary.learningPatterns.read++;
      try {
        const record = transformLearningPatternRow(row, keyBuilder);
        if (!record) {
          summary.learningPatterns.skipped++;
          continue;
        }
        if (!dryRun) {
          const inserted = await upsertEvidenceRow(db, record);
          if (inserted) summary.learningPatterns.inserted++;
          else summary.learningPatterns.skipped++;
        } else {
          summary.learningPatterns.inserted++;
        }
      } catch (err) {
        summary.errors.push({ source: 'learning_patterns', id: row.id, error: err.message });
      }
    }
  }

  const dpResult = await db.query(
    `SELECT id, pattern_type, pattern_value, library_id,
            confidence, sample_size, support_count, status, auto_approved
     FROM discovered_patterns
     WHERE status IN ('discovered', 'approved')
     ORDER BY id`
  );

  for (let offset = 0; offset < dpResult.rows.length; offset += BATCH_SIZE) {
    const batch = dpResult.rows.slice(offset, offset + BATCH_SIZE);

    for (const row of batch) {
      summary.discoveredPatterns.read++;
      try {
        const record = transformDiscoveredPatternRow(row, keyBuilder);
        if (!record) {
          summary.discoveredPatterns.skipped++;
          continue;
        }
        if (!dryRun) {
          const inserted = await upsertEvidenceRow(db, record);
          if (inserted) summary.discoveredPatterns.inserted++;
          else summary.discoveredPatterns.skipped++;
        } else {
          summary.discoveredPatterns.inserted++;
        }
      } catch (err) {
        summary.errors.push({ source: 'discovered_patterns', id: row.id, error: err.message });
      }
    }
  }

  return summary;
}

function formatSummary(summary, dryRun = false) {
  const prefix = dryRun ? '[DRY RUN] ' : '';
  const lines = [
    `${prefix}Backfill classification_evidence — complete`,
    `  learning_patterns : read=${summary.learningPatterns.read}, inserted=${summary.learningPatterns.inserted}, skipped=${summary.learningPatterns.skipped}`,
    `  discovered_patterns: read=${summary.discoveredPatterns.read}, inserted=${summary.discoveredPatterns.inserted}, skipped=${summary.discoveredPatterns.skipped}`
  ];
  if (summary.errors.length > 0) {
    lines.push(`  errors (${summary.errors.length}):`);
    for (const error of summary.errors) {
      lines.push(`    [${error.source}] id=${error.id}: ${error.error}`);
    }
  }
  return lines.join('\n');
}

async function main() {
  const [{ default: db }, { default: keyBuilder }, { default: dotenv }] = await Promise.all([
    import('../server/src/config/database.js'),
    import('../server/src/services/classificationEvidenceKeyBuilder.js'),
    import('dotenv')
  ]);

  dotenv.config({ path: '../server/.env' });

  const dryRun = process.argv.includes('--dry-run');

  try {
    console.log(`Running backfill_classification_evidence${dryRun ? ' (DRY RUN)' : ''}...`);
    const summary = await runBackfill({ db, keyBuilder, dryRun });
    console.log(formatSummary(summary, dryRun));
    if (summary.errors.length > 0) process.exit(1);
  } catch (err) {
    console.error('Backfill failed:', err.message);
    process.exit(1);
  } finally {
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  await main();
}

export {
  DISCOVERED_PATTERN_SCOPES,
  transformLearningPatternRow,
  transformDiscoveredPatternRow,
  runBackfill,
  formatSummary
};
