/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createHash } from 'node:crypto';

export const AI_RESPONSE_PREVIEW_MAX_LENGTH = 160;

export function normalizeAiResponseDiagnosticText(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildAiResponseDiagnosticArtifact(response, options = {}) {
  const normalized = normalizeAiResponseDiagnosticText(response);
  if (!normalized) {
    return null;
  }

  const requestedLength = Number(options.maxLength);
  const maxLength = Number.isInteger(requestedLength) && requestedLength > 0
    ? requestedLength
    : AI_RESPONSE_PREVIEW_MAX_LENGTH;
  const preview = normalized.slice(0, maxLength);

  return {
    fingerprint: createHash('sha256').update(normalized).digest('hex'),
    preview,
    truncated: normalized.length > preview.length,
  };
}

export const aiResponseDiagnosticsService = {
  buildAiResponseDiagnosticArtifact,
  normalizeAiResponseDiagnosticText,
};
