/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { createHash } from 'node:crypto';

const viability = new Set(['identity_evidence', 'compatibility_only', 'profile_only',
  'rag_improved', 'multi_source_support', 'no_positive_evidence']);
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const score = value => Number.isFinite(value) && value >= 0 && value <= 100;

/** Deliberately only policy-decision inputs, not a claim to replay retrieval or AI. */
export function validateReleaseDecisionInput(input) {
  if (!exact(input, ['version', 'cases']) || input.version !== 1 || !Array.isArray(input.cases) ||
      input.cases.length < 1 || input.cases.length > 300) throw new Error('release_decision_input_invalid');
  const cases = input.cases.map(row => {
    if (!exact(row, ['mediaType', 'labelLibraryId', 'candidates']) ||
        !['movie', 'tv'].includes(row.mediaType) || !positiveId(row.labelLibraryId) ||
        !Array.isArray(row.candidates) || row.candidates.length < 1 || row.candidates.length > 64) {
      throw new Error('release_decision_case_invalid');
    }
    const ids = new Set();
    const candidates = row.candidates.map(candidate => {
      if (!exact(candidate, ['policyId', 'libraryId', 'score', 'viability', 'autoThreshold', 'promptThreshold']) ||
          !positiveId(candidate.policyId) || !positiveId(candidate.libraryId) || !score(candidate.score) ||
          !viability.has(candidate.viability) || !score(candidate.autoThreshold) ||
          !score(candidate.promptThreshold) || candidate.promptThreshold > candidate.autoThreshold ||
          ids.has(candidate.policyId)) throw new Error('release_decision_candidate_invalid');
      ids.add(candidate.policyId);
      return { policyId: candidate.policyId, libraryId: candidate.libraryId, score: candidate.score,
        viability: candidate.viability, autoThreshold: candidate.autoThreshold,
        promptThreshold: candidate.promptThreshold };
    });
    return { mediaType: row.mediaType, labelLibraryId: row.labelLibraryId, candidates };
  });
  return { version: 1, cases };
}

export function fingerprintReleaseDecisionInput(input) {
  return createHash('sha256').update(JSON.stringify(validateReleaseDecisionInput(input))).digest('hex');
}

/** The worker never receives correction labels, tokens, media identity or provider metadata. */
export function projectReleaseDecisionWorkerInput(input) {
  const validated = validateReleaseDecisionInput(input);
  return { version: 1, cases: validated.cases.map(({ mediaType, candidates }) => ({ mediaType, candidates })) };
}
