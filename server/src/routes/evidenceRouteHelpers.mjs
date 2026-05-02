/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const VALID_SCOPES = ['item_exact', 'genre', 'studio', 'franchise', 'certification'];
const VALID_PROVENANCES = ['human_confirmed', 'policy_confirmed', 'mined'];
const VALID_STATUSES = ['active', 'candidate'];

export function parseIntParam(value, defaultValue, min = null, max = null) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  if (min !== null && parsed < min) return defaultValue;
  if (max !== null && parsed > max) return defaultValue;
  return parsed;
}

export function sanitizeFilter(query = {}) {
  return {
    scope: VALID_SCOPES.includes(query.scope) ? query.scope : null,
    provenance: VALID_PROVENANCES.includes(query.provenance) ? query.provenance : null,
    status: VALID_STATUSES.includes(query.status) ? query.status : null,
    libraryId: query.libraryId ? parseIntParam(query.libraryId, null, 1) : null,
    mediaType: typeof query.mediaType === 'string' ? query.mediaType : null,
  };
}
