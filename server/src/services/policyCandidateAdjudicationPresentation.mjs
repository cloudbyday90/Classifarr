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
  });
}
