/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { FORMULA_CONFIDENCE_CAP, parseFiniteNumber } from './policyEngineUtils.mjs';
import { buildPolicyHistoryScoringQuery } from './policyHistoryScoringQuery.mjs';

function scoreAggregate(row) {
  const matchCount = parseFiniteNumber(row?.match_count);
  const confidence = parseFiniteNumber(row?.confidence);
  if (!Number.isSafeInteger(matchCount) || matchCount <= 0 ||
      confidence === null || confidence < 0 || confidence > 100) return 0;

  const countBoost = Math.min(matchCount * 10, 40);
  const baseScore = Math.min(confidence, 60);
  return Math.min(baseScore + countBoost, FORMULA_CONFIDENCE_CAP);
}

export function createPolicyHistoryScorer({
  query = (...args) => db.query(...args),
  logger = createLogger('PolicyHistoryScoring'),
} = {}) {
  return async function scoreHistory(libraryId, item) {
    const statement = buildPolicyHistoryScoringQuery(libraryId, item);
    if (!statement) return 0;

    try {
      const result = await query(statement.text, statement.values);
      const match = result.rows.find((row) => row.library_id === statement.libraryId);
      return scoreAggregate(match);
    } catch {
      logger.debug('History scoring unavailable', { reason: 'history_query_failed' });
      return 0;
    }
  };
}

export const scoreHistory = createPolicyHistoryScorer();
