/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { adjudicationDigest } from '../../services/cachedAdjudicationContract.mjs';
import { evaluationHistoryCase } from '../../services/evaluationHistoryContract.mjs';

export function evaluationHistoryFixture({ revision = 'one', offset = 0, status = 'proposed', labeled = true, gap, version = 'evaluation_history.v3' } = {}) {
  const cohortRevision = adjudicationDigest('cohort'),
    evidenceRevision = adjudicationDigest(revision), modelRevision = adjudicationDigest('model');
  const result = { status, gap, destinationId: 2, latencyMs: 1, promptTokens: 1, outputTokens: 1 };
  return { version, revision: adjudicationDigest([version, cohortRevision, evidenceRevision, modelRevision]),
    cohortRevision, evidenceRevision, modelRevision, sampled: 60, eligible: 60, offset,
    cases: Array.from({ length: 25 }, (_, index) => {
      const entry = evaluationHistoryCase(`item-${offset + index}`, index % 2 ? 'tv' : 'movie',
        [{ ...result, destinationId: 1 }, result], labeled ? { libraryId: 2 } : null);
      if (version !== 'evaluation_history.v3') delete entry.pairKind;
      if (version === 'evaluation_history.v1') delete entry.gaps;
      return entry;
    }) };
}
