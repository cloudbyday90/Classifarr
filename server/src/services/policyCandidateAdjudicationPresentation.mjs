/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS,
  buildPolicyCandidateAdjudicationProjection,
} from './policyCandidateAdjudicationContract.mjs';

export const POLICY_CANDIDATE_ADJUDICATION_PRESENTATION_VERSION =
  'policy.candidate_adjudication_presentation.v1';

const STATUS_PRESENTATIONS = Object.freeze({
  [POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.PROPOSED]: Object.freeze({
    label: 'Bounded candidate comparison complete',
    message: 'AI compared only the policy-eligible destinations using bounded evidence. Its suggestion is advisory; choose the destination before this item can route.',
  }),
  [POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.ABSTAINED]: Object.freeze({
    label: 'Bounded candidate comparison abstained',
    message: 'AI did not make an advisory suggestion between the policy-eligible destinations. Review the deterministic evidence and choose the destination.',
  }),
  [POLICY_CANDIDATE_ADJUDICATION_STATUS_IDS.RESPONSE_REJECTED]: Object.freeze({
    label: 'Bounded candidate comparison response rejected',
    message: 'The AI response did not meet the advisory contract. It was not used to choose a destination; review the deterministic evidence and choose the destination.',
  }),
});

const SEMANTIC_RETRIEVAL_PRESENTATIONS = Object.freeze({
  available: Object.freeze({
    label: 'Current-library semantic check used',
    message: 'The advisory comparison included bounded similarity to descriptions of current items in each eligible library.',
  }),
  unavailable: Object.freeze({
    label: 'Current-library semantic check unavailable',
    message: 'The advisory comparison used its remaining bounded evidence; semantic similarity did not complete and did not change routing.',
  }),
});

export function buildPolicyCandidateAdjudicationPresentation(value = {}) {
  const projection = buildPolicyCandidateAdjudicationProjection(value);
  const definition = projection ? STATUS_PRESENTATIONS[projection.status_id] : null;
  if (!definition) return null;

  return Object.freeze({
    version: POLICY_CANDIDATE_ADJUDICATION_PRESENTATION_VERSION,
    status_id: projection.status_id,
    label: definition.label,
    message: definition.message,
    proposed_destination: projection.proposed_destination,
    semantic_retrieval: SEMANTIC_RETRIEVAL_PRESENTATIONS[projection.semantic_retrieval_status_id]
      ? Object.freeze({
        status_id: projection.semantic_retrieval_status_id,
        ...SEMANTIC_RETRIEVAL_PRESENTATIONS[projection.semantic_retrieval_status_id],
      })
      : null,
  });
}
