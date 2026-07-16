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

const DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS = 5 * 60 * 1000;
const MAX_ARTIFACT_EVIDENCE_DELAY_MS = 30 * 1000;
const MAX_FUTURE_TIMESTAMP_SKEW_MS = 1000;
const REVISION_PATTERN = /^[a-f0-9]{40,64}$/u;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildRisk(riskId, message, metadata = {}) {
  return { riskId, message, ...metadata };
}

function normalizeFingerprint(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeMaximumAge(value) {
  const normalized = Number(value);

  if (
    Number.isInteger(normalized) &&
    normalized > 0 &&
    normalized <= DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS
  ) {
    return normalized;
  }

  return DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS;
}

function parseTimestamp(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { value: value.toISOString(), timestampMs: value.getTime() };
  }

  if (typeof value !== 'string' || !value.trim()) return null;

  const timestampMs = Date.parse(value);

  return Number.isNaN(timestampMs) ? null : { value: value.trim(), timestampMs };
}

function resolveTimestamp(value) {
  return parseTimestamp(value) || { value: new Date().toISOString(), timestampMs: Date.now() };
}

export {
  DEFAULT_MAX_EXECUTION_ARTIFACT_AGE_MS,
  MAX_ARTIFACT_EVIDENCE_DELAY_MS,
  MAX_FUTURE_TIMESTAMP_SKEW_MS,
  REVISION_PATTERN,
  asArray,
  asObject,
  buildRisk,
  normalizeFingerprint,
  normalizeMaximumAge,
  parseTimestamp,
  resolveTimestamp,
};
