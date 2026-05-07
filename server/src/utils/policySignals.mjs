/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
export function normalizeSignalConfig(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
      return null;
    }
  }
  return value;
}
export function mergePresetSignals(baseSignals, customSignals) {
  const base = normalizeSignalConfig(baseSignals) || {};
  const custom = normalizeSignalConfig(customSignals) || null;
  const merged = JSON.parse(JSON.stringify(base));
  if (!custom) {
    return merged;
  }
  const removed = custom.removed || {};
  Object.entries(removed).forEach(([signalType, keyMap]) => {
    if (!merged[signalType]) return;
    Object.entries(keyMap || {}).forEach(([key, values]) => {
      if (!Array.isArray(merged[signalType][key])) return;
      merged[signalType][key] = merged[signalType][key].filter(item => !values.includes(item));
    });
  });
  Object.entries(custom).forEach(([signalType, config]) => {
    if (signalType === 'removed') return;
    if (!merged[signalType]) merged[signalType] = {};
    Object.entries(config || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        const existing = Array.isArray(merged[signalType][key]) ? merged[signalType][key] : [];
        merged[signalType][key] = Array.from(new Set([...existing, ...value]));
      } else {
        merged[signalType][key] = value;
      }
    });
  });
  return merged;
}
function getSignalConstraintSummary(config) {
  const normalized = normalizeSignalConfig(config) || {};
  return {
    requireAny: Array.isArray(normalized.require_any) ? normalized.require_any : [],
    exclude: Array.isArray(normalized.exclude) ? normalized.exclude : [],
    strict: normalized.strict === true
  };
}
export function describePresetRuntimeSemantics(baseSignals, customSignals) {
  const base = normalizeSignalConfig(baseSignals) || {};
  const custom = normalizeSignalConfig(customSignals) || {};
  const merged = mergePresetSignals(base, custom);
  const language = getSignalConstraintSummary(merged.language);
  const customLanguage = getSignalConstraintSummary(custom.language);
  const baseLanguage = getSignalConstraintSummary(base.language);
  const hasLanguageConstraint = language.requireAny.length > 0 || language.exclude.length > 0;
  if (!hasLanguageConstraint) {
    return {
      migration_state: 'not_applicable',
      review_recommended: false,
      badge_label: null,
      badge_tone: null,
      summary: null
    };
  }
  const hasExplicitStrictOverride = Object.prototype.hasOwnProperty.call(custom.language || {}, 'strict');
  if (language.strict === true) {
    return {
      migration_state: hasExplicitStrictOverride ? 'strict_override' : 'strict_inherited',
      review_recommended: false,
      badge_label: 'Strict runtime',
      badge_tone: 'warning',
      summary: 'This preset uses strict language semantics and can block mismatched languages from ranking.',
      required_languages: language.requireAny,
      excluded_languages: language.exclude
    };
  }
  if (hasExplicitStrictOverride && customLanguage.strict === false) {
    return {
      migration_state: 'advisory_override',
      review_recommended: false,
      badge_label: 'Advisory runtime',
      badge_tone: 'info',
      summary: 'This preset was explicitly set to advisory runtime behavior and only influences score.',
      required_languages: language.requireAny,
      excluded_languages: language.exclude
    };
  }
  return {
    migration_state: baseLanguage.strict === true ? 'advisory_override' : 'advisory_defaulted',
    review_recommended: true,
    badge_label: 'Review runtime',
    badge_tone: 'review',
    summary: 'This preset has language constraints but now defaults to advisory runtime behavior unless strict is explicitly enabled.',
    required_languages: language.requireAny,
    excluded_languages: language.exclude
  };
}

