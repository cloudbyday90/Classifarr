/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { RAG_LOOP_REASON_CODES } from './shared.mjs';
function normalizeSqlState(error) {
  const raw = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  if (!raw) {
    return null;
  }
  return /^[A-Z0-9]{5}$/.test(raw) ? raw : null;
}
function classifyDbSqlState(error) {
  const sqlState = normalizeSqlState(error);
  if (!sqlState) {
    return {
      sqlState: null,
      classCode: null,
      retryable: false,
      reasonCode: RAG_LOOP_REASON_CODES.DB_UNKNOWN_FAILURE,
    };
  }
  if (sqlState.startsWith('23')) {
    return {
      sqlState,
      classCode: '23',
      retryable: false,
      reasonCode: RAG_LOOP_REASON_CODES.DB_INTEGRITY_VIOLATION,
    };
  }
  if (sqlState.startsWith('40')) {
    return {
      sqlState,
      classCode: '40',
      retryable: true,
      reasonCode: RAG_LOOP_REASON_CODES.DB_RETRYABLE_CONFLICT,
    };
  }
  if (sqlState.startsWith('42')) {
    return {
      sqlState,
      classCode: '42',
      retryable: false,
      reasonCode: RAG_LOOP_REASON_CODES.DB_SCHEMA_MISMATCH,
    };
  }
  return {
    sqlState,
    classCode: sqlState.slice(0, 2),
    retryable: false,
    reasonCode: RAG_LOOP_REASON_CODES.DB_UNKNOWN_FAILURE,
  };
}
function isRetryableDbConflictError(error) {
  return classifyDbSqlState(error).retryable;
}
const dbHelpers = {
  classifyDbSqlState,
  isRetryableDbConflictError,
  normalizeSqlState,
};
export default dbHelpers;
export { classifyDbSqlState, isRetryableDbConflictError, normalizeSqlState };
