/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { types } from 'node:util';
import { recoveryField as field } from './policyRecoverySuggestionContract.mjs';

export const VERIFICATION_ADVICE_BYTES = 16 * 1024;
const traits = ['rating', 'genres', 'studio', 'keywords', 'language'];
const invalid = () => { throw new Error('verification_advice_projection'); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();

export function verificationAdviceLabel(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160 &&
    !/[\u0000-\u001f\u007f]/u.test(value) ? value : invalid();
}

function percentage(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : invalid();
}

export function projectVerificationAdvice(library, confidence) {
  return Object.freeze({ confidence: percentage(confidence),
    suggestedLibrary: Object.freeze({ name: verificationAdviceLabel(field(library, 'name')) }) });
}

function distribution(value, key, limit) {
  if (value === undefined) return Object.freeze([]);
  if (types.isProxy(value) || !Array.isArray(value)) return invalid();
  // Match the formatter's existing display prefix, without enumerating unused rows.
  const length = count(field(value, 'length'));
  return Object.freeze(Array.from({ length: Math.min(length, limit) }, (_unused, index) => {
    const row = field(value, String(index));
    return Object.freeze({ [key]: verificationAdviceLabel(field(row, key)), percentage: percentage(field(row, 'percentage')) });
  }));
}

/** A later inventory observation; association does not make placement a verified label. */
export function projectVerificationProfile(stats) {
  try {
    const totalItems = count(field(stats, 'totalItems'));
    if (!totalItems) return null;
    const observation = field(stats, 'observation');
    if (field(observation, 'version') !== 'library.profile_observation.v1' ||
        field(observation, 'population') !== 'inventory_rows' || field(observation, 'itemCount') !== totalItems) return null;
    const projectedTraits = {};
    for (const key of traits) {
      const trait = field(field(observation, 'traits'), key);
      const observedCount = count(field(trait, 'observedCount')), unknownCount = count(field(trait, 'unknownCount'));
      if (observedCount + unknownCount !== totalItems) return null;
      projectedTraits[key] = Object.freeze({ observedCount, unknownCount });
    }
    return Object.freeze({ totalItems,
      observation: Object.freeze({ version: 'library.profile_observation.v1', population: 'inventory_rows',
        itemCount: totalItems, traits: Object.freeze(projectedTraits) }),
      certificationDistribution: distribution(field(stats, 'certificationDistribution'), 'certification', 5),
      genreDistribution: distribution(field(stats, 'genreDistribution'), 'genre', 5),
      studioDistribution: distribution(field(stats, 'studioDistribution'), 'studio', 3),
    });
  } catch { return null; }
}

/** Called only with closed projections; never stringify caller-owned profile objects. */
export function boundVerificationAdvice(advice, profile) {
  const fits = value => Buffer.byteLength(JSON.stringify(value), 'utf8') <= VERIFICATION_ADVICE_BYTES;
  if (fits({ policySignals: advice, libraryProfile: profile })) return { policySignals: advice, libraryProfile: profile };
  return { policySignals: fits({ policySignals: advice, libraryProfile: null }) ? advice : Object.freeze({}), libraryProfile: null };
}
