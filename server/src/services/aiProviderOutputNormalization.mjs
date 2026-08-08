/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  normalizeResponseForParsing,
  stripMarkdownFences,
  stripThinkingBlocks,
} from './aiResponseNormalizer.mjs';

function looksLikeJson(value) {
  return value.startsWith('{') && value.endsWith('}');
}

/**
 * Removes provider-only wrappers before a diagnostic artifact is constructed.
 * It intentionally preserves the remaining response text for bounded parser
 * troubleshooting without retaining a thinking trace or Markdown wrapper.
 */
export function sanitizeAiProviderOutputForDiagnostics(value) {
  const raw = typeof value === 'string' ? value : '';
  return stripMarkdownFences(stripThinkingBlocks(raw));
}

/**
 * Applies the same parser-safe cleanup to every provider response before it
 * enters the semantic parser. Structured JSON remains intact for schema
 * validation; non-JSON output is normalized to the supported text contract.
 */
export function normalizeAiProviderOutput(value) {
  const raw = typeof value === 'string' ? value : '';
  const thinkingTraceDetected = raw.toLowerCase().includes('<think');
  const sanitizedOutput = sanitizeAiProviderOutputForDiagnostics(raw);
  const normalizedOutput = looksLikeJson(sanitizedOutput)
    ? sanitizedOutput
    : normalizeResponseForParsing(sanitizedOutput);

  return Object.freeze({
    normalizedOutput,
    thinkingTraceDetected,
  });
}
