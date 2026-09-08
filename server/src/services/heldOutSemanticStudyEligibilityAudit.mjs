/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import * as db from '../config/database.mjs';
import { embeddingRouter } from './embeddingRouter.mjs';
import { heldOutSemanticStudyEligibilityDiagnosticCountId } from './heldOutSemanticStudyEligibilityDiagnostics.mjs';
import {
  HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES,
  readHeldOutSemanticStudyInventoryAuditCandidates,
} from './heldOutSemanticStudyInventoryAuditSource.mjs';
import { createHeldOutSemanticStudyPreparation } from './heldOutSemanticStudyPreparation.mjs';
import { heldOutSemanticStudyConfigurationFingerprint } from './heldOutSemanticStudyProvenance.mjs';
import { HELD_OUT_SEMANTIC_STUDY_STRATA } from './heldOutSemanticStudyInventoryCandidate.mjs';
import { buildHeldOutSemanticStudyPolicySourceScreen } from './heldOutSemanticStudyPolicySourceScreen.mjs';

export const HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_VERSION =
  'policy.held_out_semantic_study_eligibility_audit.v2';

export const HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS = Object.freeze({
  CANDIDATE_SOURCE_TRUNCATED: 'candidate_source_truncated',
  COMPLETE: 'complete',
  CONFIGURATION_CHANGED: 'configuration_changed',
  FAILED: 'failed',
});

function fixedStratumCounts() {
  return Object.fromEntries(HELD_OUT_SEMANTIC_STUDY_STRATA.map((stratum) => [stratum, 0]));
}

function orderedCounts(counts) {
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))));
}

function validCandidate(candidate) {
  return candidate && typeof candidate === 'object' &&
    HELD_OUT_SEMANTIC_STUDY_STRATA.includes(candidate.stratum) &&
    candidate.metadata && typeof candidate.metadata === 'object';
}

function auditSummary({ candidates, policies, assessments, policySourceScreen }) {
  const candidateCountByStratum = fixedStratumCounts();
  const eligibleCountByStratum = fixedStratumCounts();
  const eligibilityDecisionCounts = {};
  const eligibilityStatusCounts = {};
  const identities = new Set();

  for (const [index, candidate] of candidates.entries()) {
    if (!validCandidate(candidate)) throw new Error('invalid_held_out_inventory_audit_candidate');
    const identity = `${candidate.metadata.media_type}:${candidate.metadata.tmdb_id}`;
    if (identities.has(identity)) throw new Error('duplicate_held_out_inventory_identity');
    identities.add(identity);
    candidateCountByStratum[candidate.stratum] += 1;

    const assessment = assessments[index];
    const diagnosticId = heldOutSemanticStudyEligibilityDiagnosticCountId(assessment?.diagnostic);
    eligibilityDecisionCounts[diagnosticId] = (eligibilityDecisionCounts[diagnosticId] ?? 0) + 1;
    const statusId = typeof assessment?.contract?.statusId === 'string'
      ? assessment.contract.statusId
      : 'invalid_contract';
    eligibilityStatusCounts[statusId] = (eligibilityStatusCounts[statusId] ?? 0) + 1;
    if (assessment?.contract?.valid === true && statusId === 'ready') {
      eligibleCountByStratum[candidate.stratum] += 1;
    }
  }

  return Object.freeze({
    candidateCount: candidates.length,
    candidateCountByStratum: Object.freeze(candidateCountByStratum),
    eligibilityDecisionCounts: orderedCounts(eligibilityDecisionCounts),
    eligibilityStatusCounts: orderedCounts(eligibilityStatusCounts),
    eligibleCountByStratum: Object.freeze(eligibleCountByStratum),
    independentLabelsAvailable: false,
    policyChangeEligibility: false,
    policyCount: policies.length,
    policySourceScreen,
    semanticSelection: false,
  });
}

async function loadPolicyContext(preparation) {
  if (typeof preparation.loadPoliciesWithSourceScreen === 'function') {
    return preparation.loadPoliciesWithSourceScreen();
  }
  const policies = await preparation.loadPolicies();
  return {
    policies,
    policySourceScreen: buildHeldOutSemanticStudyPolicySourceScreen({ policies }),
  };
}

function fingerprint(config, policyContext) {
  return JSON.stringify({
    configurationFingerprint: heldOutSemanticStudyConfigurationFingerprint(config, policyContext.policies),
    policySourceScreen: policyContext.policySourceScreen,
  });
}

/**
 * Measures broad-policy comparator availability across a bounded canonical
 * inventory population. It performs no semantic retrieval, writes, routing,
 * policy change, or item-level reporting.
 */
export function createHeldOutSemanticStudyEligibilityAudit({
  loadCandidates = (input) => readHeldOutSemanticStudyInventoryAuditCandidates({ query: db.query, ...input }),
  maximumCandidateCount = HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES,
  preparation = createHeldOutSemanticStudyPreparation(),
  readConfig = () => embeddingRouter.getConfig(),
} = {}) {
  return Object.freeze({
    async audit() {
      try {
        const [initialConfig, policyContext] = await Promise.all([readConfig(), loadPolicyContext(preparation)]);
        const { policies, policySourceScreen } = policyContext;
        const initialFingerprint = fingerprint(initialConfig, policyContext);
        const source = await loadCandidates({ maximumCandidateCount });
        if (!Array.isArray(source?.candidates)) throw new Error('invalid_held_out_inventory_audit_source');
        const assessments = [];
        for (const candidate of source.candidates) {
          assessments.push(await preparation.assess({ metadata: candidate.metadata, policies }));
        }
        const summary = auditSummary({ candidates: source.candidates, policies, assessments, policySourceScreen });
        const [finalConfig, finalPolicyContext] = await Promise.all([
          readConfig(), loadPolicyContext(preparation),
        ]);
        if (fingerprint(finalConfig, finalPolicyContext) !== initialFingerprint) {
          return Object.freeze({ status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.CONFIGURATION_CHANGED }), summary: null });
        }
        return Object.freeze({
          status: Object.freeze({ id: source.truncated === true
            ? HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.CANDIDATE_SOURCE_TRUNCATED
            : HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.COMPLETE }),
          summary,
        });
      } catch {
        return Object.freeze({ status: Object.freeze({ id: HELD_OUT_SEMANTIC_STUDY_ELIGIBILITY_AUDIT_STATUS_IDS.FAILED }), summary: null });
      }
    },
  });
}
