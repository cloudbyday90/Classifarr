/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { canonicalDatabaseBigintId, MAX_DATABASE_BIGINT_ID } from '../services/databaseIntegerValues.mjs';
import { ValidationError } from '../utils/appError.mjs';

const FILTER_KEYS = ['classification_id', 'classificationId'];
const savedIdText = `COALESCE((to_jsonb(error_log)->>'classification_id'), metadata->>'classificationId')`;
// Legacy logs can have leading zeros. Strip them before comparison or projection.
export const LOG_CLASSIFICATION_ID_TEXT = `ltrim(${savedIdText}, '0') COLLATE "C"`;
const maxIdLength = MAX_DATABASE_BIGINT_ID.toString().length;
export const LOG_CLASSIFICATION_ID_PROJECTION = `CASE
  WHEN length(${LOG_CLASSIFICATION_ID_TEXT}) <= ${maxIdLength} THEN ${LOG_CLASSIFICATION_ID_TEXT}
END`;

export function readLogClassificationIdFilter(query) {
  // Express's simple parser leaves bracketed keys literal and puts repeats in arrays.
  const hasBracketKey = Object.keys(query).some((key) => FILTER_KEYS.some((alias) => key.startsWith(`${alias}[`)));
  const values = FILTER_KEYS.filter((key) => Object.hasOwn(query, key))
    .map((key) => typeof query[key] === 'string' ? canonicalDatabaseBigintId(query[key]) : null);
  if (hasBracketKey || values.includes(null) || new Set(values).size > 1) {
    throw new ValidationError(
      `History ID filters must use one decimal value from 1 to ${MAX_DATABASE_BIGINT_ID} without leading zeros. If both aliases are supplied, they must agree.`,
    );
  }
  return values[0] ?? null;
}
