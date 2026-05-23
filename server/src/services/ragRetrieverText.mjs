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

import { expandRetrievalMetadata } from '../utils/ragLoopHelpers.mjs';

export function buildRetrievalText(metadata, options, formatForEmbedding) {
  const pass = options.pass || 'pass1';
  const useExpandedQuery = options.useExpandedQuery === true || pass !== 'pass1';

  if (!useExpandedQuery) {
    return formatForEmbedding(metadata);
  }

  const expandedMetadata = expandRetrievalMetadata(metadata, {
    pass,
    identifierCaps: options.identifierCaps,
    aliasEnabled: options.aliasEnabled,
    aliasMaxTerms: options.aliasMaxTerms,
    minTokenLength: options.aliasMinTokenLength,
  });

  const baseText = formatForEmbedding(expandedMetadata);
  const overrides = expandedMetadata.rag_query_overrides || {};
  const extraTerms = [];

  if (Array.isArray(overrides.alias_terms) && overrides.alias_terms.length > 0) {
    extraTerms.push(`Aliases: ${overrides.alias_terms.join(', ')}`);
  }

  const evidence = overrides.evidence_tokens || {};
  if (Array.isArray(evidence.keywords) && evidence.keywords.length > 0) {
    extraTerms.push(`Evidence Keywords: ${evidence.keywords.join(', ')}`);
  }
  if (Array.isArray(evidence.genres) && evidence.genres.length > 0) {
    extraTerms.push(`Evidence Genres: ${evidence.genres.join(', ')}`);
  }
  if (Array.isArray(evidence.studios) && evidence.studios.length > 0) {
    extraTerms.push(`Evidence Studios: ${evidence.studios.join(', ')}`);
  }
  if (Array.isArray(evidence.cast) && evidence.cast.length > 0) {
    extraTerms.push(`Evidence Cast: ${evidence.cast.join(', ')}`);
  }
  if (evidence.collection) {
    extraTerms.push(`Evidence Collection: ${evidence.collection}`);
  }

  if (extraTerms.length === 0) {
    return baseText;
  }

  return `${baseText} | ${extraTerms.join(' | ')}`;
}
