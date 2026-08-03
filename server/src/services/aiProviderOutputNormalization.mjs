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
 * Applies the same parser-safe cleanup to every provider response before it
 * enters the semantic parser. Structured JSON remains intact for schema
 * validation; non-JSON output is normalized to the supported text contract.
 */
export function normalizeAiProviderOutput(value) {
  const raw = typeof value === 'string' ? value : '';
  const thinkingTraceDetected = raw.toLowerCase().includes('<think');
  const withoutThinking = stripThinkingBlocks(raw);
  const withoutMarkdown = stripMarkdownFences(withoutThinking);
  const normalizedOutput = looksLikeJson(withoutMarkdown)
    ? withoutMarkdown
    : normalizeResponseForParsing(withoutMarkdown);

  return Object.freeze({
    normalizedOutput,
    thinkingTraceDetected,
  });
}
