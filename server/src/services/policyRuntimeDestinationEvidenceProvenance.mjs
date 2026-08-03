/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildBoundedPolicyEvidenceProjection,
} from './policyEvidenceBoundary.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
} from './policyIntentEngine.mjs';
import {
  buildPolicyLibraryProfileEvidence,
  buildPolicyLibraryProfileEvidenceAudit,
} from './policyLibraryProfileEvidence.mjs';
import {
  buildPolicyLibraryProfileFreshness,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  buildPolicyRuntimeDestinationEvidenceCandidate,
  listAffirmativeRuleValues,
} from './policyRuntimeDestinationEvidenceCandidate.mjs';
import {
  normalizePolicyEvidenceEntry,
} from './policyEvidenceEntryNormalizer.mjs';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_VERSION =
  'policy.runtime_destination_evidence_provenance.v1';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS = Object.freeze({
  INVALID_EXECUTION_STATE: 'runtime_destination_evidence_invalid_execution_state',
  NATIVE_INTENT_UNAVAILABLE: 'runtime_destination_evidence_native_intent_unavailable',
  AMBIGUOUS_NATIVE_INTENT: 'runtime_destination_evidence_ambiguous_native_intent',
  PROFILE_MISSING: 'runtime_destination_evidence_profile_missing',
  PROFILE_STALE: 'runtime_destination_evidence_profile_stale',
  PROFILE_INVALID: 'runtime_destination_evidence_profile_invalid',
  CANDIDATE_BLOCKED: 'runtime_destination_evidence_candidate_blocked',
  BOUNDED_EVIDENCE_BLOCKED: 'runtime_destination_evidence_bounded_evidence_blocked',
  BOUNDED_INTENT_BLOCKED: 'runtime_destination_evidence_bounded_intent_blocked',
});

const OPERATOR_INTENT_PREFIX_BY_SIGNAL_TYPE = Object.freeze({
  genres: 'genre',
  keywords: 'keyword',
  studios: 'studio',
  certifications: 'certification',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value, maximumLength = 160) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';

  return String(value)
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maximumLength);
}

function normalizeIdentifier(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? String(numeric) : null;
}

function firstRow(result) {
  return asArray(result?.rows)[0] || null;
}

function isIdentityRule(rule = {}) {
  const source = asObject(rule);
  return normalizeText(source.intent_role ?? source.intentRole, 40).toLowerCase() === 'purpose' &&
    normalizeText(source.semantics, 40).toLowerCase() === 'identity';
}

function isCompatibilityRule(rule = {}) {
  const source = asObject(rule);
  return normalizeText(source.intent_role ?? source.intentRole, 40).toLowerCase() === 'helpful_hint' &&
    normalizeText(source.semantics, 40).toLowerCase() === 'compatibility';
}

function buildOperatorIntentEntry({ signalType, value }) {
  const prefix = OPERATOR_INTENT_PREFIX_BY_SIGNAL_TYPE[signalType];
  const label = normalizeText(value, 120);
  if (!prefix || !label) return null;

  const entry = normalizePolicyEvidenceEntry({
    key: `${prefix}:${label}`,
    label,
    value: label,
  });

  return entry?.key && entry.value
    ? { key: entry.key, label: entry.label, value: entry.value }
    : null;
}

function buildOperatorIntent(nativeRules = []) {
  const belongsHere = [];
  const helpfulMatches = [];

  asArray(nativeRules).forEach(rule => {
    const signalType = normalizeText(rule?.signal_type ?? rule?.signalType, 80).toLowerCase();
    const entries = listAffirmativeRuleValues(rule)
      .map(value => buildOperatorIntentEntry({ signalType, value }))
      .filter(Boolean);

    if (isIdentityRule(rule)) belongsHere.push(...entries);
    if (isCompatibilityRule(rule)) helpfulMatches.push(...entries);
  });

  const uniqueByKey = entries => [...new Map(entries.map(entry => [entry.key, entry])).values()];
  return {
    belongsHere: uniqueByKey(belongsHere),
    helpfulMatches: uniqueByKey(helpfulMatches),
  };
}

async function listActiveNativeIntentRules({ client, libraryId } = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('Destination evidence provenance requires a transaction client.');
  }

  const result = await client.query(
    `SELECT
       intent.id AS intent_id,
       intent.policy_id,
       intent.library_id,
       intent.intent_version,
       intent.source,
       intent.inference_state,
       intent.validation_status,
       rule.id AS rule_id,
       rule.intent_role,
       rule.collection,
       rule.signal_type,
       rule.operator,
       rule.values,
       rule.semantics
     FROM policy_intents AS intent
     INNER JOIN policy_intent_rules AS rule ON rule.intent_id = intent.id
     WHERE intent.library_id = $1
       AND intent.active = TRUE
       AND intent.source = 'native_intent'
       AND intent.inference_state = 'inferred'
       AND intent.validation_status IN ('valid', 'warning')
     FOR SHARE OF intent, rule`,
    [libraryId],
  );

  return asArray(result?.rows);
}

async function loadLibraryProfile({ client, libraryId } = {}) {
  const result = await client.query(
    `SELECT
       library_id,
       rating_distribution,
       genre_distribution,
       studio_distribution,
       keyword_distribution,
       exclusion_ratings,
       exclusion_genres,
       exclusion_keywords,
       item_count,
       enriched_count,
       last_generated_at,
       updated_at
     FROM library_profiles
     WHERE library_id = $1
     FOR SHARE`,
    [libraryId],
  );

  return firstRow(result);
}

function buildResult({
  statusId,
  reasonCodes = [],
  candidate = null,
  boundedIntentResult = null,
  nativeIntentId = null,
  nativePolicyId = null,
  profileFreshness = null,
} = {}) {
  return {
    version: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_VERSION,
    ok: statusId === POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.READY,
    statusId,
    reasonCodes: [...new Set(reasonCodes.filter(Boolean))],
    candidate,
    boundedIntentResult,
    provenance: {
      nativeIntentId,
      nativePolicyId,
      profileFreshness: profileFreshness
        ? {
          stale: profileFreshness.stale === true,
          updatedAt: profileFreshness.updatedAt || null,
        }
        : null,
    },
    sideEffects: {
      providerLookupPerformed: false,
      providerQuotaRead: false,
      ragEvidenceRead: false,
      aiTextRead: false,
    },
  };
}

async function buildPolicyRuntimeDestinationEvidenceProvenance({
  client,
  executionState = {},
  now = Date.now(),
  listRules = listActiveNativeIntentRules,
  getProfile = loadLibraryProfile,
} = {}) {
  const state = asObject(executionState);
  const classification = asObject(state.classification);
  const destination = asObject(state.destination);
  const libraryId = normalizeIdentifier(destination.id);
  if (state.ok !== true || !libraryId || !destination.name || !classification.id) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.INVALID_EXECUTION_STATE],
    });
  }

  const nativeRules = await listRules({ client, libraryId });
  const intentIds = [...new Set(nativeRules.map(row => normalizeIdentifier(row.intent_id)).filter(Boolean))];
  if (intentIds.length !== 1) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [intentIds.length > 1
        ? POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.AMBIGUOUS_NATIVE_INTENT
        : POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.NATIVE_INTENT_UNAVAILABLE],
    });
  }

  const profile = await getProfile({ client, libraryId });
  if (!profile) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.PROFILE_MISSING],
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
    });
  }

  const profileEvidence = buildPolicyLibraryProfileEvidence(profile);
  const profileEvidenceAudit = buildPolicyLibraryProfileEvidenceAudit(profileEvidence);
  const profileFreshness = buildPolicyLibraryProfileFreshness({ profile, now });
  if (!profileEvidenceAudit.ok) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.PROFILE_INVALID],
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
      profileFreshness,
    });
  }
  if (profileFreshness.stale === true) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.PROFILE_STALE],
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
      profileFreshness,
    });
  }

  const candidateResult = buildPolicyRuntimeDestinationEvidenceCandidate({
    classification,
    destination,
    nativeRules,
  });
  if (!candidateResult.ok || !candidateResult.candidate) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [
        POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.CANDIDATE_BLOCKED,
        ...candidateResult.reasonCodes,
      ],
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
      profileFreshness,
    });
  }

  const boundedEvidenceResult = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      libraryProfile: profileEvidence.libraryProfile,
      operatorIntent: buildOperatorIntent(nativeRules),
      classificationOutcomes: [candidateResult.candidate],
      profileFreshness,
    },
  });
  if (!boundedEvidenceResult.ok) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.BOUNDED_EVIDENCE_BLOCKED],
      candidate: candidateResult.candidate,
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
      profileFreshness,
    });
  }

  const boundedIntentResult = buildPolicyIntentDraftFromBoundedEvidence({
    boundedEvidenceResult,
  });
  if (!boundedIntentResult.ok || boundedIntentResult.evidenceFingerprintAudit?.ok !== true) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.BLOCKED,
      reasonCodes: [POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS.BOUNDED_INTENT_BLOCKED],
      candidate: candidateResult.candidate,
      boundedIntentResult,
      nativeIntentId: intentIds[0],
      nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
      profileFreshness,
    });
  }

  return buildResult({
    statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS.READY,
    candidate: candidateResult.candidate,
    boundedIntentResult,
    nativeIntentId: intentIds[0],
    nativePolicyId: normalizeIdentifier(nativeRules[0]?.policy_id),
    profileFreshness,
  });
}

export {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_REASON_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_STATUS_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_PROVENANCE_VERSION,
  buildOperatorIntent,
  buildPolicyRuntimeDestinationEvidenceProvenance,
  listActiveNativeIntentRules,
  loadLibraryProfile,
};
