/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const MAX_STARTER_TEMPLATE_SUGGESTIONS = 8;
const MAX_TEMPLATE_SIGNAL_VALUES = 24;
const MAX_VALUE_LENGTH = 160;

const STARTER_TEMPLATE_SIGNAL_TYPES = Object.freeze({
  genres: 'genres',
  keywords: 'keywords',
  studios: 'studios',
});

const STARTER_TEMPLATE_SIGNAL_ENTRIES = Object.freeze([
  ['genres', STARTER_TEMPLATE_SIGNAL_TYPES.genres],
  ['keywords', STARTER_TEMPLATE_SIGNAL_TYPES.keywords],
  ['studios', STARTER_TEMPLATE_SIGNAL_TYPES.studios],
]);

const SUGGESTION_STOPWORDS = new Set([
  'a', 'an', 'and', 'for', 'in', 'of', 'on', 'the', 'to', 'with',
  'library', 'libraries', 'media', 'content',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseObject(value) {
  if (typeof value !== 'string') return asObject(value);

  try {
    return asObject(JSON.parse(value));
  } catch {
    return {};
  }
}

function normalizeString(value, maximumLength = MAX_VALUE_LENGTH) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function tokenizeStarterTemplateSuggestion(value) {
  return Array.from(new Set(
    normalizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 2)
      .filter(token => !SUGGESTION_STOPWORDS.has(token)),
  ));
}

function compactStarterTemplateSuggestion(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function countTokenOverlap(leftTokens, rightTokens) {
  const right = new Set(rightTokens);
  return leftTokens.filter(token => right.has(token)).length;
}

function normalizeTemplateSuggestion(template = {}, library = {}) {
  const source = asObject(template);
  const signals = parseObject(source.signals);
  const libraryName = normalizeString(library.name ?? library.libraryName);
  const libraryTokens = tokenizeStarterTemplateSuggestion(libraryName);
  const compactLibraryName = compactStarterTemplateSuggestion(libraryName);
  const key = normalizeString(source.key).toLowerCase();
  const name = normalizeString(source.name).toLowerCase();
  const description = normalizeString(source.description).toLowerCase();
  const category = normalizeString(source.category).toLowerCase();
  const keyTokens = tokenizeStarterTemplateSuggestion(key);
  const nameTokens = tokenizeStarterTemplateSuggestion(name);
  const descriptionTokens = tokenizeStarterTemplateSuggestion(description);
  const categoryTokens = tokenizeStarterTemplateSuggestion(category);
  const compactKey = compactStarterTemplateSuggestion(key);
  const compactName = compactStarterTemplateSuggestion(name);
  const genreSignals = parseObject(signals.genres);
  const genreValues = [
    ...asArray(genreSignals.require_any),
    ...asArray(genreSignals.prefer),
  ].flatMap(tokenizeStarterTemplateSuggestion);
  const suggestionReasons = [];
  let score = 0;

  const keyMatchCount = countTokenOverlap(libraryTokens, keyTokens);
  if (keyMatchCount > 0) {
    score += Math.min(40, keyMatchCount * 40);
    suggestionReasons.push('key_token_match');
  }

  const nameMatchCount = countTokenOverlap(libraryTokens, nameTokens);
  if (nameMatchCount > 0) {
    score += Math.min(30, nameMatchCount * 15);
    suggestionReasons.push('name_token_match');
  }

  if (
    (compactKey.length >= 4 && compactLibraryName.includes(compactKey)) ||
    (compactName.length >= 4 && compactLibraryName.includes(compactName))
  ) {
    score += 25;
    suggestionReasons.push('phrase_match');
  }

  const genreMatchCount = countTokenOverlap(libraryTokens, genreValues);
  if (genreMatchCount > 0) {
    score += Math.min(20, genreMatchCount * 10);
    suggestionReasons.push('genre_token_match');
  }

  const descriptionMatchCount = countTokenOverlap(libraryTokens, descriptionTokens);
  if (descriptionMatchCount > 0) {
    score += Math.min(10, descriptionMatchCount * 5);
    suggestionReasons.push('description_token_match');
  }

  const categoryMatchCount = countTokenOverlap(libraryTokens, categoryTokens);
  if (categoryMatchCount > 0) {
    score += 10;
    suggestionReasons.push('category_token_match');
  }

  const suggestionWarnings = [];
  if (
    asArray(parseObject(signals.language).require_any).length > 0 ||
    asArray(parseObject(signals.media_type).include).length > 0
  ) {
    suggestionWarnings.push('runtime_semantics_review_recommended');
  }

  return {
    ...source,
    signals,
    suggestion_score: score,
    suggestion_reasons: suggestionReasons,
    suggestion_warnings: suggestionWarnings,
    match_score: score,
    match_reasons: suggestionReasons,
  };
}

function buildPolicyStarterTemplateSuggestions({ library, presets = [], limit = MAX_STARTER_TEMPLATE_SUGGESTIONS } = {}) {
  const libraryName = normalizeString(library?.name ?? library?.libraryName);
  if (!libraryName) return [];

  const boundedLimit = Math.max(0, Math.min(MAX_STARTER_TEMPLATE_SUGGESTIONS, Number(limit) || 0));
  if (boundedLimit === 0) return [];

  return asArray(presets)
    .map(template => normalizeTemplateSuggestion(template, library))
    .filter(template => template.suggestion_score > 0)
    .sort((left, right) => right.suggestion_score - left.suggestion_score)
    .slice(0, boundedLimit);
}

function buildPolicyStarterTemplateIntentSignalSuggestions({
  suggestions = [],
  limit = MAX_TEMPLATE_SIGNAL_VALUES,
} = {}) {
  const boundedLimit = Math.max(0, Math.min(MAX_TEMPLATE_SIGNAL_VALUES, Number(limit) || 0));
  if (boundedLimit === 0) return [];

  const uniqueSuggestions = new Map();

  asArray(suggestions).forEach((suggestion) => {
    if (uniqueSuggestions.size >= boundedLimit) return;

    const source = asObject(suggestion);
    const templateId = normalizeString(source.id ?? source.preset_id ?? source.key, 80);
    const templateName = normalizeString(source.name ?? source.key);
    const signals = parseObject(source.signals);
    if (!templateId || !templateName) return;

    STARTER_TEMPLATE_SIGNAL_ENTRIES.forEach(([signalKey, signalType]) => {
      asArray(parseObject(signals[signalKey]).require_any).forEach((value) => {
        if (uniqueSuggestions.size >= boundedLimit) return;

        const normalizedValue = normalizeString(value);
        if (!normalizedValue) return;

        const key = `${signalType}:${normalizedValue.toLocaleLowerCase()}`;
        if (uniqueSuggestions.has(key)) return;

        uniqueSuggestions.set(key, {
          templateId,
          templateName,
          signalType,
          value: normalizedValue,
          label: normalizedValue,
          explanation: `Suggested by the optional ${templateName} starter template.`,
        });
      });
    });
  });

  return Array.from(uniqueSuggestions.values());
}

export {
  MAX_STARTER_TEMPLATE_SUGGESTIONS,
  MAX_TEMPLATE_SIGNAL_VALUES,
  STARTER_TEMPLATE_SIGNAL_TYPES,
  buildPolicyStarterTemplateIntentSignalSuggestions,
  buildPolicyStarterTemplateSuggestions,
  compactStarterTemplateSuggestion,
  countTokenOverlap,
  tokenizeStarterTemplateSuggestion,
};
