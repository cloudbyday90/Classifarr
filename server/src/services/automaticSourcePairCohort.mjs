/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';
import { prepareSourceDescriptionEvaluationCohort } from './sourceDescriptionEvaluationCohort.mjs';

export const AUTOMATIC_SOURCE_PAIR_OPTIONS = Object.freeze({ seed: 'automatic-source-pair-v1', size: 300 });
const reference = doc => createHash('sha256').update(JSON.stringify([doc.key, doc.hash])).digest('hex');
export const validSourcePairCohort = value => Array.isArray(value) && value.length <= 300 &&
  value.every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)) && new Set(value).size === value.length;

/** Removed/changed/merged identities rotate a cohort, never silently shrink it. */
export function freezeAutomaticSourcePairCohort(source, state, observedAt) {
  let reason = 'created';
  const age = Date.parse(observedAt) - new Date(state?.cohort_created_at ?? NaN).getTime();
  if (validSourcePairCohort(state?.cohort) && state.cohort.length && Number.isFinite(age) && age >= 0 && age < 30 * 86400_000) {
    const references = new Set(state.cohort);
    const fixedSampleKeys = new Set(source.corpus.documents.filter(doc => references.has(reference(doc))).map(doc => doc.key));
    if (fixedSampleKeys.size === references.size) {
      try {
        prepareSourceDescriptionEvaluationCohort(source, AUTOMATIC_SOURCE_PAIR_OPTIONS, { fixedSampleKeys });
        return { cohort: state.cohort, cohortCreatedAt: state.cohort_created_at, fixedSampleKeys, reason: 'reused' };
      } catch (error) {
        if (error.message !== 'source_pair_fixed_cohort_invalid') throw error;
      }
    }
    reason = 'source_changed';
  } else if (state?.cohort?.length) reason = 'expired';
  const { sample } = prepareSourceDescriptionEvaluationCohort(source, AUTOMATIC_SOURCE_PAIR_OPTIONS);
  return { cohort: sample.map(reference).sort(), cohortCreatedAt: observedAt,
    fixedSampleKeys: new Set(sample.map(doc => doc.key)), reason };
}
