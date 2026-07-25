/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { createLogger } from '../utils/logger.mjs';
import { isPolicyRuntimeQuestionPersistenceEnvelope } from './policyRuntimeQuestionPersistenceContract.mjs';

const logger = createLogger('clarificationService');

export const LOW_CONFIDENCE_THRESHOLD = 70;
export const SEED_INTEGRITY_CACHE_TTL_MS = 5 * 60 * 1000;

export function clampConfidence(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function createStatusError(message, statusCode, code = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) {
    error.code = code;
  }
  return error;
}

export function safeParseJson(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    logger.warn('Failed to parse policy_question JSON', { error: error.message });
    return null;
  }
}

export function parsePolicyQuestion(value) {
  if (!value) return null;
  return typeof value === 'string' ? safeParseJson(value) : value;
}

export function getQuestionOptionLibraryIds(question) {
  if (
    !question ||
    isPolicyRuntimeQuestionPersistenceEnvelope(question) ||
    !Array.isArray(question.options)
  ) {
    return [];
  }

  return Array.from(new Set(
    question.options
      .map((option) => Number.parseInt(option?.library_id, 10))
      .filter((libraryId) => Number.isInteger(libraryId) && libraryId > 0)
  ));
}
