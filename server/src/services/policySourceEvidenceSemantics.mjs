/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import {
  SIGNAL_SEMANTICS,
  hasAffirmativeSignalConstraints,
  normalizeSignalConfig,
  normalizeSignalSemantics,
  resolveSignalSemantics,
} from '../utils/policySignals.mjs';

const BROAD_GENRE_TERMS = new Set([
  'action',
  'adventure',
  'comedy',
  'drama',
  'family',
  'romance',
]);

function configuredTerms(config = {}) {
  return [
    ...(Array.isArray(config.require_all) ? config.require_all : []),
    ...(Array.isArray(config.require_any) ? config.require_any : []),
    ...(Array.isArray(config.prefer) ? config.prefer : []),
  ]
    .map((term) => String(term || '').trim().toLowerCase())
    .filter(Boolean);
}

function hasRequireConstraint(config = {}) {
  return (Array.isArray(config.require_all) && config.require_all.length > 0)
    || (Array.isArray(config.require_any) && config.require_any.length > 0);
}

export function resolvePresetSignalEvidenceMode(signalType, rawConfig) {
  const config = normalizeSignalConfig(rawConfig);
  if (!config || !hasAffirmativeSignalConstraints(config, signalType)) {
    return null;
  }

  const explicit = normalizeSignalSemantics(config.semantics);
  if (explicit) {
    return explicit;
  }

  if (signalType === 'keywords' && !hasRequireConstraint(config)) {
    return SIGNAL_SEMANTICS.COMPATIBILITY;
  }

  if (signalType === 'genres') {
    const terms = configuredTerms(config);
    const broadOnly = terms.length > 0 && terms.every((term) => BROAD_GENRE_TERMS.has(term));
    if (broadOnly && !hasRequireConstraint({ require_all: config.require_all })) {
      return SIGNAL_SEMANTICS.COMPATIBILITY;
    }
  }

  return resolveSignalSemantics(signalType, config);
}
