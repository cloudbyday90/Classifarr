/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const RETRY_AUDIT_FILTER = 'classification_retry';
const RETRY_AUDIT_MODULE = 'ClassificationRetryService';
const RETRY_AUDIT_MESSAGE_PREFIX = 'Classification retry%';

export const REASON_CODE_EXPR = `COALESCE((to_jsonb(error_log)->>'reason_code'), metadata->>'reasonCode')`;
export const CORRELATION_ID_EXPR = `COALESCE((to_jsonb(error_log)->>'correlation_id'), metadata->>'correlationId')`;
export const ERROR_STAGE_EXPR = `COALESCE((to_jsonb(error_log)->>'error_stage'), metadata->>'errorStage')`;
export const SQL_STATE_EXPR = `COALESCE((to_jsonb(error_log)->>'sql_state'), metadata->>'sqlState')`;
export const CLASSIFICATION_ID_TEXT_EXPR = `COALESCE((to_jsonb(error_log)->>'classification_id'), metadata->>'classificationId')`;

import { logsLimiterConfig } from '../config/rateLimits.mjs';

export function createLogsLimiter(rateLimit) {
  return rateLimit(logsLimiterConfig);
}

export function buildLogsWhereClause(query = {}, { includeDateRange = false } = {}) {
  const whereConditions = [];
  const queryParams = [];
  let paramCount = 1;

  if (query.level) {
    whereConditions.push(`level = $${paramCount++}`);
    queryParams.push(query.level.toUpperCase());
  }

  if (query.module) {
    whereConditions.push(`module = $${paramCount++}`);
    queryParams.push(query.module);
  }

  if (query.resolved !== undefined) {
    whereConditions.push(`resolved = $${paramCount++}`);
    queryParams.push(query.resolved === 'true');
  }

  if (includeDateRange && query.startDate) {
    whereConditions.push(`created_at >= $${paramCount++}`);
    queryParams.push(query.startDate);
  }

  if (includeDateRange && query.endDate) {
    whereConditions.push(`created_at <= $${paramCount++}`);
    queryParams.push(query.endDate);
  }

  const stage = query.error_stage || query.stage;
  if (stage) {
    whereConditions.push(`${ERROR_STAGE_EXPR} = $${paramCount++}`);
    queryParams.push(stage);
  }

  const reasonCode = query.reason_code || query.reasonCode;
  if (reasonCode) {
    whereConditions.push(`${REASON_CODE_EXPR} = $${paramCount++}`);
    queryParams.push(reasonCode);
  }

  const sqlState = query.sql_state || query.sqlState;
  if (sqlState) {
    whereConditions.push(`UPPER(${SQL_STATE_EXPR}) = $${paramCount++}`);
    queryParams.push(sqlState.toUpperCase());
  }

  const classificationId = Number.parseInt(query.classification_id || query.classificationId, 10);
  if (Number.isInteger(classificationId) && classificationId > 0) {
    whereConditions.push(`(${CLASSIFICATION_ID_TEXT_EXPR}) ~ '^[0-9]+$'`);
    whereConditions.push(`(${CLASSIFICATION_ID_TEXT_EXPR})::int = $${paramCount++}`);
    queryParams.push(classificationId);
  }

  const correlationId = query.correlation_id || query.correlationId;
  if (correlationId) {
    whereConditions.push(`${CORRELATION_ID_EXPR} = $${paramCount++}`);
    queryParams.push(correlationId);
  }

  const audit = String(query.audit || '').trim().toLowerCase();
  if (audit === RETRY_AUDIT_FILTER) {
    whereConditions.push(`module = $${paramCount++}`);
    queryParams.push(RETRY_AUDIT_MODULE);
    whereConditions.push(`message ILIKE $${paramCount++}`);
    queryParams.push(RETRY_AUDIT_MESSAGE_PREFIX);
  }

  return {
    whereClause: whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '',
    queryParams,
    nextParamIndex: paramCount,
  };
}
