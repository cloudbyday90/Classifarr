/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { createHash, createHmac } from 'node:crypto';
import {
  POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS,
} from './policyCandidateContrastiveRetrievalContract.mjs';
import { heldOutSemanticStudyEligibilityDiagnosticCountId } from './heldOutSemanticStudyEligibilityDiagnostics.mjs';

export const HELD_OUT_SEMANTIC_STUDY_COHORT_PLANNER_VERSION =
  'policy.held_out_semantic_study_cohort_planner.v1';

export const HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS = Object.freeze({
  COMPLETE: 'captured_pending_independent_labels',
  INSUFFICIENT_ELIGIBLE_CASES: 'insufficient_eligible_cases',
  INVALID_CANDIDATE_SOURCE: 'invalid_candidate_source',
});

export const HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA = Object.freeze([
  'documentary',
  'genre-overlap',
  'ordinary',
  'reality',
]);

export const HELD_OUT_SEMANTIC_STUDY_DEFAULT_COHORT_CASE_COUNT = 28;

const MINIMUM_CASES = 24;
const MAXIMUM_CASES = 32;
const MINIMUM_PER_STRATUM = 4;
const CONTRACT_STATUS_IDS = new Set(Object.values(POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS));

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null;
}

function validMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    ['movie', 'tv'].includes(value.media_type) &&
    positiveInteger(value.tmdb_id) &&
    typeof value.title === 'string' && value.title.trim().length > 0;
}

function identityKey(metadata) {
  return `${metadata.media_type}:${metadata.tmdb_id}`;
}

function fixedCountByStratum() {
  return Object.fromEntries(HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.map((stratum) => [stratum, 0]));
}

function contractStatusId(contract) {
  return CONTRACT_STATUS_IDS.has(contract?.statusId) ? contract.statusId : 'invalid_contract';
}

/**
 * Produces the fixed, balanced target shape used by a later private capture.
 * It contains no inventory information and does not select any media.
 */
export function buildHeldOutSemanticStudyCohortTargets(caseCount = HELD_OUT_SEMANTIC_STUDY_DEFAULT_COHORT_CASE_COUNT) {
  if (!Number.isInteger(caseCount) || caseCount < MINIMUM_CASES || caseCount > MAXIMUM_CASES) {
    return null;
  }
  const targets = Object.fromEntries(HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.map((stratum) => [
    stratum,
    MINIMUM_PER_STRATUM,
  ]));
  let remaining = caseCount - HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.length * MINIMUM_PER_STRATUM;
  for (let index = 0; remaining > 0; index = (index + 1) % HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.length) {
    targets[HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA[index]] += 1;
    remaining -= 1;
  }
  return Object.freeze(targets);
}

function createOpaqueIdentifier(prefix, selectionSecret, identity) {
  return `${prefix}_${createHmac('sha256', selectionSecret).update(`${prefix}:${identity}`).digest('hex')}`;
}

function selectionCommitment(selectionSecret) {
  return `sha256:${createHash('sha256').update(selectionSecret).digest('hex')}`;
}

function orderedCounts(counts) {
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))));
}

function buildReceipt({
  caseCount,
  eligibilityDecisionCounts,
  eligibilityStatusCounts,
  eligibleByStratum,
  selectedByStratum,
  selectionSecret,
  statusId,
}) {
  return Object.freeze({
    automaticRoutingEligibility: false,
    caseCount,
    eligibilityDecisionCounts: orderedCounts(eligibilityDecisionCounts),
    eligibilityStatusCounts: orderedCounts(eligibilityStatusCounts),
    eligibleByStratum: Object.freeze({ ...eligibleByStratum }),
    independentLabelsAvailable: false,
    policyChangeEligibility: false,
    selectedByStratum: Object.freeze({ ...selectedByStratum }),
    selectionCommitment: selectionCommitment(selectionSecret),
    semanticSelection: false,
    statusId,
    version: HELD_OUT_SEMANTIC_STUDY_COHORT_PLANNER_VERSION,
  });
}

function invalidPlan(selectionSecret) {
  return Object.freeze({
    receipt: buildReceipt({
      caseCount: 0,
      eligibilityDecisionCounts: {},
      eligibilityStatusCounts: {},
      eligibleByStratum: fixedCountByStratum(),
      selectedByStratum: fixedCountByStratum(),
      selectionSecret,
      statusId: HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.INVALID_CANDIDATE_SOURCE,
    }),
    request: null,
  });
}

/**
 * Selects a balanced cohort using broad-policy eligibility only. Candidates
 * must arrive in source-owned deterministic order. Semantic retrieval runs
 * only after this method has frozen the complete request.
 */
export function createHeldOutSemanticStudyCohortPlanner({
  preparation,
} = {}) {
  return Object.freeze({
    async plan({ candidates, caseCount = HELD_OUT_SEMANTIC_STUDY_DEFAULT_COHORT_CASE_COUNT, policies, selectionSecret } = {}) {
      if (!preparation || (typeof preparation.prepare !== 'function' && typeof preparation.assess !== 'function') ||
          !Array.isArray(candidates) || !Array.isArray(policies) ||
          !Buffer.isBuffer(selectionSecret) || selectionSecret.length < 16 ||
          !Number.isInteger(caseCount) || caseCount < MINIMUM_CASES || caseCount > MAXIMUM_CASES) {
        return invalidPlan(selectionSecret ?? Buffer.alloc(16));
      }

      const targets = buildHeldOutSemanticStudyCohortTargets(caseCount);
      const eligibilityStatusCounts = {};
      const eligibilityDecisionCounts = {};
      const eligibleByStratum = fixedCountByStratum();
      const selectedByStratum = fixedCountByStratum();
      const eligible = Object.fromEntries(HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.map((stratum) => [stratum, []]));
      const seenIdentities = new Set();

      for (const candidate of candidates) {
        const metadata = candidate?.metadata;
        const stratum = candidate?.stratum;
        if (!validMetadata(metadata) || !HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.includes(stratum)) {
          return invalidPlan(selectionSecret);
        }
        const key = identityKey(metadata);
        if (seenIdentities.has(key)) return invalidPlan(selectionSecret);
        seenIdentities.add(key);

        const assessment = typeof preparation.assess === 'function'
          ? await preparation.assess({ metadata, policies })
          : { contract: await preparation.prepare({ metadata, policies }), diagnostic: null };
        const contract = assessment?.contract;
        const contractStatus = contractStatusId(contract);
        eligibilityStatusCounts[contractStatus] = (eligibilityStatusCounts[contractStatus] ?? 0) + 1;
        if (assessment?.diagnostic) {
          const diagnosticId = heldOutSemanticStudyEligibilityDiagnosticCountId(assessment.diagnostic);
          eligibilityDecisionCounts[diagnosticId] = (eligibilityDecisionCounts[diagnosticId] ?? 0) + 1;
        }
        if (contract?.valid !== true || contractStatus !==
            POLICY_CANDIDATE_CONTRASTIVE_RETRIEVAL_CONTRACT_STATUS_IDS.READY) continue;
        eligible[stratum].push(Object.freeze({ contract, metadata }));
        eligibleByStratum[stratum] += 1;
      }

      if (HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA.some((stratum) => eligible[stratum].length < targets[stratum])) {
        return Object.freeze({
          receipt: buildReceipt({
            caseCount,
            eligibilityDecisionCounts,
            eligibilityStatusCounts,
            eligibleByStratum,
            selectedByStratum,
            selectionSecret,
            statusId: HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.INSUFFICIENT_ELIGIBLE_CASES,
          }),
          request: null,
        });
      }

      const selected = [];
      for (const stratum of HELD_OUT_SEMANTIC_STUDY_COHORT_STRATA) {
        for (const candidate of eligible[stratum].slice(0, targets[stratum])) {
          const identity = identityKey(candidate.metadata);
          selected.push(Object.freeze({
            fixtureId: createOpaqueIdentifier('fixture', selectionSecret, identity),
            metadata: candidate.metadata,
            snapshotId: createOpaqueIdentifier('snapshot', selectionSecret, identity),
            stratum,
          }));
          selectedByStratum[stratum] += 1;
        }
      }

      return Object.freeze({
        receipt: buildReceipt({
          caseCount,
          eligibilityDecisionCounts,
          eligibilityStatusCounts,
          eligibleByStratum,
          selectedByStratum,
          selectionSecret,
          statusId: HELD_OUT_SEMANTIC_STUDY_COHORT_STATUS_IDS.COMPLETE,
        }),
        request: Object.freeze({
          cases: Object.freeze(selected.map(({ fixtureId, metadata, snapshotId }) => Object.freeze({
            fixtureId,
            metadata,
            snapshotId,
          }))),
          snapshotSetId: createOpaqueIdentifier('snapshot_set', selectionSecret, 'cohort'),
        }),
        selected: Object.freeze(selected),
      });
    },
  });
}
