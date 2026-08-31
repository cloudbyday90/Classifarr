/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as defaultDb from '../config/database.mjs';

const MAX_ROUTING_VALUE_LENGTH = 120;
const MAX_ROUTING_ERROR_LENGTH = 500;
const ROUTED_STATUS = 'routed';

function positiveInteger(value) {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function boundedText(value, maximumLength) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function normalizedStatus(value) {
  return value === ROUTED_STATUS ? ROUTED_STATUS : null;
}

/**
 * Builds a parameterized partial JSONB update for routing state.  Routing runs
 * after the classification record is initially persisted, so replacing the
 * caller's stale metadata object here would erase decision evidence captured
 * during that first write.
 */
export function buildClassificationRoutingMetadataUpdate({
  classificationId,
  routing,
  routingError = null,
  status = null,
} = {}) {
  const id = positiveInteger(classificationId);
  const normalizedRouting = boundedText(routing, MAX_ROUTING_VALUE_LENGTH);
  const normalizedRoutingError = routingError === null || routingError === undefined
    ? null
    : boundedText(routingError, MAX_ROUTING_ERROR_LENGTH);

  if (!id || !normalizedRouting || (routingError != null && !normalizedRoutingError)) {
    throw new TypeError('A valid classification ID, routing state, and optional routing error are required');
  }

  return Object.freeze({
    text: `
      UPDATE classification_history
      SET status = COALESCE($3::varchar, status),
          metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{classification_details}',
            (
              (
                CASE
                  WHEN jsonb_typeof(COALESCE(metadata, '{}'::jsonb) -> 'classification_details') = 'object'
                    THEN COALESCE(metadata, '{}'::jsonb) -> 'classification_details'
                  ELSE '{}'::jsonb
                END
              ) - 'routing_error'
            )
            || jsonb_build_object('routing', $1::text)
            || CASE
              WHEN $2::text IS NULL THEN '{}'::jsonb
              ELSE jsonb_build_object('routing_error', $2::text)
            END,
            true
          )
      WHERE id = $4
    `,
    values: Object.freeze([
      normalizedRouting,
      normalizedRoutingError,
      normalizedStatus(status),
      id,
    ]),
  });
}

/**
 * Owns the narrow post-classification persistence boundary for routing state.
 * It preserves all pre-existing classification detail keys, including bounded
 * RAG, candidate, and AI-advisory projections, while replacing only routing
 * fields controlled by the server.
 */
export class ClassificationRoutingMetadataPersistenceService {
  constructor({ db = defaultDb } = {}) {
    this.db = db;
  }

  async persist(input = {}) {
    const statement = buildClassificationRoutingMetadataUpdate(input);
    return this.db.query(statement.text, statement.values);
  }
}
