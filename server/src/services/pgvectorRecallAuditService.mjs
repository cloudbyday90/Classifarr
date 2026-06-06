/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as db from '../config/database.mjs';
import { NotFoundError, ValidationError } from '../utils/appError.mjs';
import { applyPgvectorRecallSettings, resolvePgvectorRecallTuning } from './pgvectorRecallTuning.mjs';

const DEFAULT_SAMPLE_SIZE = 3;
const MAX_SAMPLE_SIZE = 10;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

function parseBoundedInteger(value, {
  name,
  defaultValue,
  min,
  max,
}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || String(value).trim() !== String(parsed)) {
    throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  }
  if (parsed < min || parsed > max) {
    throw new ValidationError(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function normalizeRecallAuditOptions(options = {}) {
  const classificationId = parseBoundedInteger(options.classification_id ?? options.classificationId, {
    name: 'classification_id',
    defaultValue: null,
    min: 1,
    max: Number.MAX_SAFE_INTEGER,
  });
  const requestedSampleSize = parseBoundedInteger(options.sample_size ?? options.sampleSize, {
    name: 'sample_size',
    defaultValue: DEFAULT_SAMPLE_SIZE,
    min: 1,
    max: MAX_SAMPLE_SIZE,
  });

  return {
    classificationId,
    sampleSize: classificationId ? 1 : requestedSampleSize,
    limit: parseBoundedInteger(options.limit, {
      name: 'limit',
      defaultValue: DEFAULT_LIMIT,
      min: 1,
      max: MAX_LIMIT,
    }),
  };
}

async function loadAuditSources(dbClient, options) {
  const params = [];
  let classificationFilter = '';
  if (options.classificationId) {
    params.push(options.classificationId);
    classificationFilter = `AND ce.classification_id = $${params.length}`;
  }
  params.push(options.sampleSize);

  const result = await dbClient.query(`
    SELECT
      ce.id AS embedding_id,
      ce.classification_id,
      ch.title,
      ch.media_type,
      ch.library_id,
      ch.library_name,
      ch.created_at
    FROM classification_embeddings ce
    JOIN classification_history ch ON ch.id = ce.classification_id
    WHERE ce.is_stale = false
      AND ce.embedding IS NOT NULL
      AND ch.library_id IS NOT NULL
      ${classificationFilter}
    ORDER BY ch.created_at DESC, ce.id DESC
    LIMIT $${params.length}
  `, params);

  if (options.classificationId && result.rows.length === 0) {
    throw new NotFoundError('Classification embedding not found for recall audit');
  }

  return result.rows;
}

async function runNeighborQuery(dbClient, {
  sourceEmbeddingId,
  limit,
  exact,
  recallTuning,
}) {
  return dbClient.withTransaction(async (client) => {
    if (exact) {
      await client.query("SELECT set_config('enable_indexscan', $1, true)", ['off']);
    } else {
      await applyPgvectorRecallSettings(client, recallTuning);
    }

    const result = await client.query(`
      WITH source AS MATERIALIZED (
        SELECT id, embedding
        FROM classification_embeddings
        WHERE id = $1
          AND is_stale = false
          AND embedding IS NOT NULL
      )
      SELECT
        ce.id AS embedding_id,
        ce.classification_id,
        ch.title,
        ch.media_type,
        ch.library_id,
        ch.library_name,
        ch.method,
        ch.confidence,
        ch.created_at,
        ce.embedding <=> source.embedding AS distance,
        1 - (ce.embedding <=> source.embedding) AS similarity
      FROM source
      JOIN classification_embeddings ce ON ce.id <> source.id
      JOIN classification_history ch ON ch.id = ce.classification_id
      WHERE ce.is_stale = false
        AND ce.embedding IS NOT NULL
        AND ch.library_id IS NOT NULL
      ORDER BY ce.embedding <=> source.embedding
      LIMIT $2
    `, [sourceEmbeddingId, limit]);

    return result.rows;
  });
}

function presentNeighbor(row) {
  return {
    embedding_id: row.embedding_id,
    classification_id: row.classification_id,
    title: row.title,
    media_type: row.media_type,
    library_id: row.library_id,
    library_name: row.library_name,
    method: row.method,
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    similarity: Number(row.similarity ?? 0),
    distance: Number(row.distance ?? 0),
    created_at: row.created_at,
  };
}

function buildSampleResult(source, { exactRows, approximateRows }) {
  const exactIds = new Set(exactRows.map((row) => row.embedding_id));
  const approximateIds = new Set(approximateRows.map((row) => row.embedding_id));
  const overlapCount = approximateRows.filter((row) => exactIds.has(row.embedding_id)).length;
  const recall = exactRows.length === 0 ? null : overlapCount / exactRows.length;

  return {
    source: {
      embedding_id: source.embedding_id,
      classification_id: source.classification_id,
      title: source.title,
      media_type: source.media_type,
      library_id: source.library_id,
      library_name: source.library_name,
      created_at: source.created_at,
    },
    exact_count: exactRows.length,
    approximate_count: approximateRows.length,
    overlap_count: overlapCount,
    recall,
    exact_top: exactRows.map(presentNeighbor),
    approximate_top: approximateRows.map(presentNeighbor),
    missed_from_approximate: exactRows
      .filter((row) => !approximateIds.has(row.embedding_id))
      .map(presentNeighbor),
    approximate_only: approximateRows
      .filter((row) => !exactIds.has(row.embedding_id))
      .map(presentNeighbor),
  };
}

function buildSummary(samples) {
  const recallValues = samples
    .map((sample) => sample.recall)
    .filter((recall) => Number.isFinite(recall));
  const averageRecall = recallValues.length
    ? recallValues.reduce((sum, value) => sum + value, 0) / recallValues.length
    : null;

  return {
    sample_count: samples.length,
    average_recall: averageRecall,
    min_recall: recallValues.length ? Math.min(...recallValues) : null,
    samples_with_misses: samples.filter((sample) => sample.missed_from_approximate.length > 0).length,
  };
}

export async function runPgvectorRecallAudit(options = {}, { dbClient = db } = {}) {
  const normalizedOptions = normalizeRecallAuditOptions(options);
  const recallTuning = resolvePgvectorRecallTuning({ candidateSearch: true });
  const sources = await loadAuditSources(dbClient, normalizedOptions);

  const samples = [];
  for (const source of sources) {
    const approximateRows = await runNeighborQuery(dbClient, {
      sourceEmbeddingId: source.embedding_id,
      limit: normalizedOptions.limit,
      exact: false,
      recallTuning,
    });
    const exactRows = await runNeighborQuery(dbClient, {
      sourceEmbeddingId: source.embedding_id,
      limit: normalizedOptions.limit,
      exact: true,
      recallTuning,
    });
    samples.push(buildSampleResult(source, { exactRows, approximateRows }));
  }

  return {
    mode: 'exact_vs_approximate',
    checked_at: new Date().toISOString(),
    options: {
      classification_id: normalizedOptions.classificationId,
      sample_size: normalizedOptions.sampleSize,
      limit: normalizedOptions.limit,
    },
    approximate_settings: {
      ef_search: recallTuning.efSearch,
      iterative_scan: recallTuning.iterativeScan,
      max_scan_tuples: recallTuning.maxScanTuples,
      scan_mem_multiplier: recallTuning.scanMemMultiplier,
    },
    summary: buildSummary(samples),
    samples,
  };
}

export const pgvectorRecallAuditService = {
  runAudit: runPgvectorRecallAudit,
};

