/**
 * Description: Exports an anonymized Issue 285 dataset from classification_history (with corrections applied).
 * Usage:
 *   node execution/export_issue_285_dataset.mjs --outDir .tmp/issue-285/dataset --sinceDays 548
 * Env:
 *   DATABASE_URL (preferred) OR POSTGRES_HOST/PORT/DB/USER/PASSWORD
 * Exit codes:
 *   0 success
 *   2 invalid args / missing env
 *   3 db failure
 */

import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import {
  ensureDir,
  loadDotenv,
  nowIsoUtc,
  parseArgs,
  sha256Hex,
  stableStringify,
  writeJson,
  writeJsonl,
} from './issue_285/lib.mjs';

function buildDbConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : 5432;
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  if (!host || !database || !user || !password) return null;
  return { host, port, database, user, password };
}

function coerceMetadata(meta) {
  // Ensure metadata is a plain object.
  if (!meta) return {};
  if (typeof meta === 'object') return meta;
  try {
    return JSON.parse(meta);
  } catch {
    return {};
  }
}

function pickPublicFields(metadata) {
  // Only keep fields used for embedding context (no local paths, no usernames).
  const out = {};
  const allow = [
    'title',
    'year',
    'media_type',
    'genres',
    'keywords',
    'overview',
    'vote_average',
    'certification',
    'content_rating',
    'original_language',
    'production_companies',
    'belongs_to_collection',
    'cast',
  ];
  for (const k of allow) {
    if (metadata[k] !== undefined) out[k] = metadata[k];
  }
  return out;
}

async function main() {
  // Allow local execution via repo-root .env (optional). Does not override process env.
  await loadDotenv();

  const args = parseArgs(process.argv.slice(2), {
    outDir: { type: 'string', default: '.tmp/issue-285/dataset' },
    sinceDays: { type: 'int', default: 548 },
    minConfidence: { type: 'int', default: 0 },
    excludeMethod: { type: 'string', default: 'source_library' },
    batchSize: { type: 'int', default: 1000 },
    maxRows: { type: 'int', default: 0 },
  });

  const dbConfig = buildDbConfig();
  if (!dbConfig) {
    console.error('Missing DB config. Set DATABASE_URL or POSTGRES_HOST/POSTGRES_DB/POSTGRES_USER/POSTGRES_PASSWORD.');
    process.exit(2);
  }

  const outDir = path.resolve(args.outDir);
  await ensureDir(outDir);

  const meta = {
    generated_at: nowIsoUtc(),
    host: os.hostname(),
    node: process.version,
    args,
  };

  // Resolve pg from server/ dependencies (not root).
  const requireFromServer = createRequire(path.join(process.cwd(), 'server', 'package.json'));
  const { Client } = requireFromServer('pg');

  const client = new Client(dbConfig);
  try {
    await client.connect();
  } catch (e) {
    console.error(`DB connect failed: ${e.message}`);
    process.exit(3);
  }

  // Keyset pagination by (created_at, id) for deterministic paging.
  const sinceDate = new Date(Date.now() - args.sinceDays * 24 * 60 * 60 * 1000);
  let lastCreatedAt = null;
  let lastId = null;

  const rows = [];
  const librariesById = new Map();
  let total = 0;

  try {
    while (true) {
      const params = [];
      let idx = 1;

      let where = `ch.created_at >= $${idx++} AND ch.method != $${idx++}`;
      params.push(sinceDate.toISOString());
      params.push(args.excludeMethod);

      if (args.minConfidence > 0) {
        where += ` AND COALESCE(ch.confidence, 0) >= $${idx++}`;
        params.push(args.minConfidence);
      }

      if (lastCreatedAt !== null && lastId !== null) {
        where += ` AND (ch.created_at, ch.id) > ($${idx++}, $${idx++})`;
        params.push(lastCreatedAt);
        params.push(lastId);
      }

      // Apply latest correction if present; otherwise use ch.library_id.
      // Using LATERAL keeps this single-query and deterministic.
      const sql = `
        SELECT
          ch.id,
          ch.created_at,
          ch.method,
          ch.media_type,
          ch.tmdb_id,
          ch.title,
          ch.confidence,
          ch.metadata,
          COALESCE(cc.corrected_library_id, ch.library_id) AS label_library_id,
          l.name AS label_library_name
        FROM classification_history ch
        LEFT JOIN LATERAL (
          SELECT corrected_library_id
          FROM classification_corrections
          WHERE classification_id = ch.id
          ORDER BY created_at DESC
          LIMIT 1
        ) cc ON true
        LEFT JOIN libraries l
          ON l.id = COALESCE(cc.corrected_library_id, ch.library_id)
        WHERE ${where}
          AND COALESCE(cc.corrected_library_id, ch.library_id) IS NOT NULL
        ORDER BY ch.created_at ASC, ch.id ASC
        LIMIT $${idx++}
      `;

      params.push(args.batchSize);
      const result = await client.query(sql, params);
      if (result.rows.length === 0) break;

      for (const r of result.rows) {
        const metadata = pickPublicFields(coerceMetadata(r.metadata));
        metadata.media_type = r.media_type || metadata.media_type || null;
        metadata.title = r.title || metadata.title || null;

        rows.push({
          id: r.id,
          created_at: new Date(r.created_at).toISOString(),
          media_type: r.media_type,
          tmdb_id: r.tmdb_id ?? null,
          confidence: r.confidence ?? null,
          method: r.method,
          label_library_id: r.label_library_id,
          label_library_name: r.label_library_name ?? null,
          metadata,
        });

        if (r.label_library_id && r.label_library_name) {
          librariesById.set(String(r.label_library_id), {
            id: r.label_library_id,
            name: r.label_library_name,
          });
        }

        total += 1;
        if (args.maxRows > 0 && total >= args.maxRows) break;
      }

      const last = result.rows[result.rows.length - 1];
      lastCreatedAt = last.created_at;
      lastId = last.id;

      if (args.maxRows > 0 && total >= args.maxRows) break;
    }
  } catch (e) {
    console.error(`DB query failed: ${e.message}`);
    process.exit(3);
  } finally {
    await client.end().catch(() => {});
  }

  const libraries = [...librariesById.values()].sort((a, b) => a.id - b.id);

  const datasetPath = path.join(outDir, 'dataset.jsonl');
  const librariesPath = path.join(outDir, 'libraries.json');
  const metaPath = path.join(outDir, 'meta.json');

  // Deterministic content hash of outputs for reproducibility.
  const datasetHash = sha256Hex(rows.map(r => JSON.stringify(r)).join('\n'));
  const librariesHash = sha256Hex(stableStringify(libraries));

  await writeJsonl(datasetPath, rows);
  await writeJson(librariesPath, libraries);
  await writeJson(metaPath, {
    ...meta,
    since_date_utc: sinceDate.toISOString(),
    counts: {
      rows: rows.length,
      libraries: libraries.length,
    },
    hashes: {
      dataset_sha256: datasetHash,
      libraries_sha256: librariesHash,
    },
  });

  console.log(`Wrote ${rows.length} rows to ${datasetPath}`);
  console.log(`Wrote ${libraries.length} libraries to ${librariesPath}`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(3);
});
