/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const {
  clamp,
  HIGH_IMPACT_FIELDS,
  LANGUAGE_QUERY_KEYWORDS,
  normalizeToken,
  normalizeTokenArray,
  RAG_LOOP_FALLBACK_ACTIONS,
  RAG_LOOP_REASON_CODES,
  toNumber,
} = require('./shared.shared');

function isMissingField(metadata, fieldName) {
  const value = metadata ? metadata[fieldName] : null;
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return value === null || value === undefined || value === '';
}

function getMissingHighImpactFields(metadata = {}) {
  return HIGH_IMPACT_FIELDS.filter((fieldName) => isMissingField(metadata, fieldName));
}

function getMetadataCompleteness(metadata = {}, config = {}) {
  const missingFields = getMissingHighImpactFields(metadata);
  const threshold = toNumber(config.policy_recheck_metadata_missing_fields_min, 2);

  return {
    missingFields,
    missingCount: missingFields.length,
    threshold,
    isSparse: missingFields.length >= threshold,
  };
}

function hasActionablePolicyContext(policyResult = null) {
  if (!policyResult || typeof policyResult !== 'object') {
    return false;
  }

  const action = typeof policyResult.action === 'string'
    ? policyResult.action.trim().toLowerCase()
    : '';
  const ranked = Array.isArray(policyResult.ranked) ? policyResult.ranked.filter(Boolean) : [];
  const hasLibrary = !!policyResult.library;

  if (action === 'prompt_select' || action === 'prompt_confirm') {
    return true;
  }

  if ((action === 'auto_classify' || action === 'manual') && (hasLibrary || ranked.length > 0)) {
    return true;
  }

  return hasLibrary || ranked.length > 0;
}

function resolvePolicyContextOrFallback(item = {}) {
  const policyResult = item.policyResult || null;
  const hasContext = hasActionablePolicyContext(policyResult);

  if (hasContext) {
    return {
      hasPolicyContext: true,
      reasonCode: null,
      fallbackAction: null,
    };
  }

  return {
    hasPolicyContext: false,
    reasonCode: RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING,
    fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.GATE_SKIPPED,
  };
}

function extractVerifiableEvidence(metadata = {}, identifierCaps = {}) {
  const caps = {
    keywords: clamp(toNumber(identifierCaps.keywords, 8), 0, 25),
    genres: clamp(toNumber(identifierCaps.genres, 5), 0, 25),
    studios: clamp(toNumber(identifierCaps.studios, 3), 0, 25),
    cast: clamp(toNumber(identifierCaps.cast, 3), 0, 25),
  };

  const keywords = normalizeTokenArray(metadata.keywords || [], caps.keywords, 1);
  const genres = normalizeTokenArray(metadata.genres || [], caps.genres, 1);
  const studios = normalizeTokenArray(metadata.production_companies || metadata.studios || [], caps.studios, 1);
  const cast = normalizeTokenArray(metadata.cast || [], caps.cast, 1);

  const titles = normalizeTokenArray([
    metadata.title,
    metadata.original_title,
    metadata.original_name,
  ], 3, 1);

  const collectionRaw = metadata.belongs_to_collection;
  const collection = normalizeToken(collectionRaw);

  return {
    keywords,
    genres,
    studios,
    cast,
    titles,
    collection: collection || null,
    language: metadata.original_language || null,
    totalTokens: keywords.length + genres.length + studios.length + cast.length + titles.length + (collection ? 1 : 0),
  };
}

function getRecheckEligibility(item = {}, metadata = {}, config = {}) {
  const trigger = item.trigger || null;
  const policyContext = item.policyContext || resolvePolicyContextOrFallback(item);
  const completeness = getMetadataCompleteness(metadata, config);
  const evidence = extractVerifiableEvidence(
    metadata,
    item.identifierCaps || config.policy_recheck_identifier_caps || {},
  );
  const minHighImpactFields = clamp(
    toNumber(config.policy_recheck_min_high_impact_fields, 2),
    0,
    HIGH_IMPACT_FIELDS.length,
  );
  const presentHighImpactFields = HIGH_IMPACT_FIELDS.length - completeness.missingCount;
  const aiCandidates = normalizeTokenArray(
    metadata.ai_identifier_candidates || metadata.ai_identifiers || [],
    25,
    1,
  );

  if (trigger !== 'policy_prompt_select' && trigger !== 'policy_prompt_confirm') {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.TRIGGER_NOT_POLICY,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (!policyContext.hasPolicyContext) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.POLICY_CONTEXT_MISSING,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (!metadata.tmdb_id) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.MISSING_TMDB_ID,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (!metadata.media_type) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.MISSING_MEDIA_TYPE,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (config.policy_recheck_metadata_source === 'authoritative_only' && aiCandidates.length > 0 && evidence.totalTokens === 0) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.NON_AUTHORITATIVE_IDENTIFIERS_REJECTED,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (presentHighImpactFields < minHighImpactFields) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.INSUFFICIENT_HIGH_IMPACT_METADATA,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  if (evidence.totalTokens <= 0) {
    return {
      eligible: false,
      reasonCode: RAG_LOOP_REASON_CODES.NO_VERIFIABLE_EVIDENCE,
      fallbackAction: RAG_LOOP_FALLBACK_ACTIONS.POLICY_RECHECK_SKIPPED,
      metadataCompleteness: completeness,
      evidence,
    };
  }

  return {
    eligible: true,
    reasonCode: null,
    fallbackAction: null,
    metadataCompleteness: completeness,
    evidence,
  };
}

function expandRetrievalMetadata(metadata = {}, options = {}) {
  const identifierCaps = options.identifierCaps || {};
  const minTokenLength = clamp(toNumber(options.minTokenLength, 2), 1, 10);
  const aliasEnabled = options.aliasEnabled !== false;
  const aliasMaxTerms = clamp(toNumber(options.aliasMaxTerms, 5), 1, 20);

  const evidence = extractVerifiableEvidence(metadata, identifierCaps);
  const expanded = {
    ...metadata,
    keywords: evidence.keywords,
    genres: evidence.genres,
    production_companies: evidence.studios.map((name) => ({ name })),
    cast: evidence.cast.map((name) => ({ name })),
  };

  if (!expanded.belongs_to_collection && evidence.collection) {
    expanded.belongs_to_collection = { name: evidence.collection };
  }

  const titleCandidates = [metadata.title, metadata.original_title, metadata.original_name]
    .map((title) => normalizeToken(title))
    .filter((title) => title && title.length >= minTokenLength);

  const aliasTerms = [];
  if (aliasEnabled) {
    for (const title of titleCandidates) {
      if (!aliasTerms.includes(title)) {
        aliasTerms.push(title);
      }
      if (aliasTerms.length >= aliasMaxTerms) {
        break;
      }
    }
  }

  const animeHints = new Set([...evidence.keywords, ...evidence.genres]);
  if (animeHints.has('anime') || metadata.original_language === 'ja') {
    if (!expanded.keywords.includes('anime')) {
      expanded.keywords = [...expanded.keywords, 'anime'];
    }
  }

  const langCode = metadata.original_language;
  if (langCode && langCode !== 'en') {
    const langKeyword = LANGUAGE_QUERY_KEYWORDS[langCode.toLowerCase()];
    if (langKeyword && !expanded.keywords.includes(langKeyword)) {
      expanded.keywords = [...expanded.keywords, langKeyword];
    }
  }

  expanded.rag_query_overrides = {
    pass: options.pass || 'pass2',
    alias_terms: aliasTerms,
    evidence_tokens: {
      keywords: evidence.keywords,
      genres: evidence.genres,
      studios: evidence.studios,
      cast: evidence.cast,
      collection: evidence.collection,
      language: evidence.language,
    },
  };

  return expanded;
}

module.exports = {
  expandRetrievalMetadata,
  extractVerifiableEvidence,
  getMetadataCompleteness,
  getMissingHighImpactFields,
  getRecheckEligibility,
  hasActionablePolicyContext,
  resolvePolicyContextOrFallback,
};
