/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const DEFAULT_EF_SEARCH = 80;
const DEFAULT_CANDIDATE_EF_SEARCH = 100;
const DEFAULT_CANDIDATE_LIMIT_MIN = 50;
const DEFAULT_CANDIDATE_LIMIT_MULTIPLIER = 10;
const DEFAULT_CANDIDATE_LIMIT_MAX = 200;
const DEFAULT_ITERATIVE_SCAN = 'relaxed_order';

const EF_SEARCH_MIN = 40;
const EF_SEARCH_MAX = 1000;
const CANDIDATE_LIMIT_MIN_MIN = 1;
const CANDIDATE_LIMIT_MIN_MAX = 500;
const CANDIDATE_LIMIT_MULTIPLIER_MIN = 1;
const CANDIDATE_LIMIT_MULTIPLIER_MAX = 50;
const CANDIDATE_LIMIT_MAX_MIN = 25;
const CANDIDATE_LIMIT_MAX_MAX = 5000;
const MAX_SCAN_TUPLES_MIN = 1000;
const MAX_SCAN_TUPLES_MAX = 1_000_000;
const SCAN_MEM_MULTIPLIER_MIN = 1;
const SCAN_MEM_MULTIPLIER_MAX = 100;

const ITERATIVE_SCAN_MODES = new Set(['off', 'strict_order', 'relaxed_order']);

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clampNumber(parsed, min, max);
}

function parseOptionalInteger(value, min, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return parseInteger(value, null, min, max);
}

function parseOptionalFloat(value, min, max) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return clampNumber(parsed, min, max);
}

function parseIterativeScan(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return DEFAULT_ITERATIVE_SCAN;
  }
  const normalized = value.trim().toLowerCase();
  return ITERATIVE_SCAN_MODES.has(normalized) ? normalized : DEFAULT_ITERATIVE_SCAN;
}

export function resolvePgvectorRecallTuning(options = {}) {
  const candidateSearch = options.candidateSearch === true;
  const defaultEfSearch = candidateSearch ? DEFAULT_CANDIDATE_EF_SEARCH : DEFAULT_EF_SEARCH;
  const efSearchEnv = candidateSearch
    ? process.env.PGVECTOR_EF_SEARCH_CANDIDATES
    : process.env.PGVECTOR_EF_SEARCH;

  const efSearch = parseInteger(
    options.efSearch ?? efSearchEnv,
    defaultEfSearch,
    EF_SEARCH_MIN,
    EF_SEARCH_MAX,
  );
  const candidateLimitMin = parseInteger(
    process.env.PGVECTOR_CANDIDATE_LIMIT_MIN,
    DEFAULT_CANDIDATE_LIMIT_MIN,
    CANDIDATE_LIMIT_MIN_MIN,
    CANDIDATE_LIMIT_MIN_MAX,
  );
  const candidateLimitMultiplier = parseInteger(
    process.env.PGVECTOR_CANDIDATE_LIMIT_MULTIPLIER,
    DEFAULT_CANDIDATE_LIMIT_MULTIPLIER,
    CANDIDATE_LIMIT_MULTIPLIER_MIN,
    CANDIDATE_LIMIT_MULTIPLIER_MAX,
  );
  const candidateLimitMax = Math.max(
    candidateLimitMin,
    parseInteger(
      process.env.PGVECTOR_CANDIDATE_LIMIT,
      DEFAULT_CANDIDATE_LIMIT_MAX,
      CANDIDATE_LIMIT_MAX_MIN,
      CANDIDATE_LIMIT_MAX_MAX,
    ),
  );

  return {
    efSearch,
    candidateSearch,
    candidateLimitMin,
    candidateLimitMultiplier,
    candidateLimitMax,
    iterativeScan: parseIterativeScan(process.env.PGVECTOR_HNSW_ITERATIVE_SCAN),
    maxScanTuples: parseOptionalInteger(
      process.env.PGVECTOR_HNSW_MAX_SCAN_TUPLES,
      MAX_SCAN_TUPLES_MIN,
      MAX_SCAN_TUPLES_MAX,
    ),
    scanMemMultiplier: parseOptionalFloat(
      process.env.PGVECTOR_HNSW_SCAN_MEM_MULTIPLIER,
      SCAN_MEM_MULTIPLIER_MIN,
      SCAN_MEM_MULTIPLIER_MAX,
    ),
  };
}

export function resolvePgvectorCandidateLimit(limit, tuning) {
  const requestedLimit = parseInteger(limit, 5, 1, CANDIDATE_LIMIT_MAX_MAX);
  const rawCandidateLimit = requestedLimit * tuning.candidateLimitMultiplier;
  return Math.min(Math.max(rawCandidateLimit, tuning.candidateLimitMin), tuning.candidateLimitMax);
}

export async function applyPgvectorRecallSettings(client, tuning) {
  await client.query("SELECT set_config('hnsw.ef_search', $1, true)", [String(tuning.efSearch)]);

  if (tuning.iterativeScan !== 'off') {
    await client.query("SELECT set_config('hnsw.iterative_scan', $1, true)", [tuning.iterativeScan]);
  }
  if (tuning.maxScanTuples !== null) {
    await client.query("SELECT set_config('hnsw.max_scan_tuples', $1, true)", [String(tuning.maxScanTuples)]);
  }
  if (tuning.scanMemMultiplier !== null) {
    await client.query("SELECT set_config('hnsw.scan_mem_multiplier', $1, true)", [String(tuning.scanMemMultiplier)]);
  }
}
