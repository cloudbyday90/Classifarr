/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildAiProviderAuthorityView } from './aiProviderAuthority.mjs';

/**
 * Binds the server-owned authority projection to a parsed AI classification.
 * This is deliberately a data-only boundary: AI output can describe a
 * candidate, but its authority can never grant a side effect.
 */
export function attachAiProviderAuthorityToClassificationResult({
  result,
  authority,
} = {}) {
  if (result && typeof result === 'object') {
    result.ai_authority = buildAiProviderAuthorityView(authority);
  }

  return result;
}
