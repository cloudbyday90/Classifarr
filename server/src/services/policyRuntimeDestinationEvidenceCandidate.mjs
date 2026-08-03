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
  POLICY_BROAD_GENRE_LABELS,
} from './policyBroadGenreIdentityEligibility.mjs';
import {
  normalizePolicyEvidenceEntry,
} from './policyEvidenceEntryNormalizer.mjs';
import {
  POLICY_LEARNING_TIER_IDS,
} from './policyLearningGuard.mjs';
import {
  normalizeMetadataList,
} from '../utils/metadataNormalization.mjs';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_VERSION =
  'policy.runtime_destination_evidence_candidate.v1';

const POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED: 'blocked',
});

const POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS = Object.freeze({
  NO_AUTHORITATIVE_RULE: 'runtime_destination_evidence_no_authoritative_rule',
  MISSING_STRUCTURED_METADATA: 'runtime_destination_evidence_missing_structured_metadata',
  BROAD_GENRE_BLOCKED: 'runtime_destination_evidence_broad_genre_blocked',
  AMBIGUOUS_CANDIDATE: 'runtime_destination_evidence_ambiguous_candidate',
  UNSUPPORTED_SIGNAL: 'runtime_destination_evidence_unsupported_signal',
});

const AFFIRMATIVE_RULE_VALUE_KEY_BY_OPERATOR = Object.freeze({
  require_all: 'require_all',
  require_any: 'require_any',
  prefer: 'prefer',
  include: 'include',
});

const SIGNAL_CONFIGURATION_BY_NATIVE_TYPE = Object.freeze({
  genres: Object.freeze({
    keyPrefix: 'genre',
    signalType: 'genre',
    tiers: Object.freeze([
      POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
    ]),
  }),
  keywords: Object.freeze({
    keyPrefix: 'keyword',
    signalType: 'keyword',
    tiers: Object.freeze([POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE]),
  }),
  studios: Object.freeze({
    keyPrefix: 'studio',
    signalType: 'studio',
    tiers: Object.freeze([
      POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE,
      POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE,
    ]),
  }),
  certifications: Object.freeze({
    keyPrefix: 'certification',
    signalType: 'certification',
    tiers: Object.freeze([POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE]),
  }),
});

const BROAD_GENRE_LABEL_SET = new Set(POLICY_BROAD_GENRE_LABELS);

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

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function canonicalSignalValue({ prefix, value }) {
  const label = normalizeText(value, 120);
  if (!label) return null;

  const entry = normalizePolicyEvidenceEntry({
    key: `${prefix}:${label}`,
    label,
    value: label,
  });

  return entry?.key && entry.value
    ? { key: entry.key, label, value: entry.value }
    : null;
}

function listStructuredMetadataValues(classification = {}, nativeSignalType) {
  const source = asObject(classification);
  const metadata = asObject(source.metadata);
  const tmdb = asObject(metadata.tmdb);
  const values = [];

  switch (nativeSignalType) {
    case 'genres':
      values.push(...normalizeMetadataList(metadata.genres));
      values.push(...normalizeMetadataList(tmdb.genres));
      values.push(...normalizeMetadataList(source.genreNames));
      break;
    case 'keywords':
      values.push(...normalizeMetadataList(metadata.keywords));
      values.push(...normalizeMetadataList(tmdb.keywords));
      break;
    case 'studios':
      values.push(...normalizeMetadataList(metadata.production_companies));
      values.push(...normalizeMetadataList(tmdb.production_companies));
      values.push(normalizeText(metadata.studio, 120));
      values.push(normalizeText(tmdb.studio, 120));
      values.push(normalizeText(source.primaryStudioName, 120));
      break;
    case 'certifications':
      values.push(normalizeText(metadata.certification, 40));
      values.push(normalizeText(metadata.content_rating, 40));
      values.push(normalizeText(tmdb.certification, 40));
      values.push(normalizeText(tmdb.content_rating, 40));
      break;
    default:
      break;
  }

  return [...new Set(values.map(value => normalizeText(value, 120)).filter(Boolean))];
}

function listAffirmativeRuleValues(rule = {}) {
  const source = asObject(rule);
  const valueKey = AFFIRMATIVE_RULE_VALUE_KEY_BY_OPERATOR[
    normalizeText(source.operator, 40).toLowerCase()
  ];
  const values = parseJsonObject(source.values);

  return valueKey
    ? asArray(values[valueKey]).map(value => normalizeText(value, 120)).filter(Boolean)
    : [];
}

function getCandidateTier(rule = {}) {
  const source = asObject(rule);
  const intentRole = normalizeText(source.intent_role ?? source.intentRole, 40).toLowerCase();
  const semantics = normalizeText(source.semantics, 40).toLowerCase();

  if (intentRole === 'purpose' && semantics === 'identity') {
    return POLICY_LEARNING_TIER_IDS.IDENTITY_EVIDENCE;
  }
  if (intentRole === 'helpful_hint' && semantics === 'compatibility') {
    return POLICY_LEARNING_TIER_IDS.COMPATIBILITY_EVIDENCE;
  }

  return null;
}

function isBroadGenre({ nativeSignalType, value }) {
  return nativeSignalType === 'genres' &&
    BROAD_GENRE_LABEL_SET.has(normalizeText(value, 120).toLowerCase());
}

function buildCandidate({ tierId, configuration, value, destination = {} }) {
  const signal = canonicalSignalValue({ prefix: configuration.keyPrefix, value });
  if (!signal) return null;

  return {
    key: signal.key,
    label: signal.label,
    signalType: configuration.signalType,
    destinationLibraryId: destination.id || null,
    destinationLibraryName: destination.name || null,
    // This represents the independent native-rule and structured-item intersections.
    evidenceCount: 2,
    evidenceSource: 'locked_native_intent_and_structured_metadata',
    tierId,
  };
}

function buildResult({ statusId, reasonCodes = [], candidate = null, candidateCount = 0 } = {}) {
  return {
    version: POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_VERSION,
    ok: statusId === POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_STATUS_IDS.READY,
    statusId,
    reasonCodes: [...new Set(Array.from(reasonCodes).filter(Boolean))],
    candidate,
    candidateCount,
    sideEffects: {
      providerLookupPerformed: false,
      providerQuotaRead: false,
      aiTextRead: false,
      ragEvidenceRead: false,
    },
  };
}

function buildPolicyRuntimeDestinationEvidenceCandidate({
  classification = {},
  destination = {},
  nativeRules = [],
} = {}) {
  const candidates = [];
  const reasonCodes = new Set();
  let supportedRuleCount = 0;
  let structuredMetadataFound = false;

  asArray(nativeRules).forEach(rule => {
    const tierId = getCandidateTier(rule);
    const nativeSignalType = normalizeText(rule?.signal_type ?? rule?.signalType, 80).toLowerCase();
    const configuration = SIGNAL_CONFIGURATION_BY_NATIVE_TYPE[nativeSignalType];
    if (!tierId || !configuration || !configuration.tiers.includes(tierId)) {
      if (tierId) reasonCodes.add(POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.UNSUPPORTED_SIGNAL);
      return;
    }

    supportedRuleCount += 1;
    const metadataValues = listStructuredMetadataValues(classification, nativeSignalType);
    if (metadataValues.length === 0) return;
    structuredMetadataFound = true;
    const metadataSignals = new Map(metadataValues.map(value => {
      const canonical = canonicalSignalValue({ prefix: configuration.keyPrefix, value });
      return canonical ? [canonical.key, canonical] : null;
    }).filter(Boolean));

    listAffirmativeRuleValues(rule).forEach(ruleValue => {
      const signal = canonicalSignalValue({ prefix: configuration.keyPrefix, value: ruleValue });
      if (!signal || !metadataSignals.has(signal.key)) return;
      if (isBroadGenre({ nativeSignalType, value: signal.value })) {
        reasonCodes.add(POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.BROAD_GENRE_BLOCKED);
        return;
      }

      const candidate = buildCandidate({
        tierId,
        configuration,
        value: metadataSignals.get(signal.key).label,
        destination,
      });
      if (candidate) candidates.push(candidate);
    });
  });

  const uniqueCandidates = [...new Map(candidates.map(candidate => [
    `${candidate.tierId}:${candidate.key}`,
    candidate,
  ])).values()];
  if (uniqueCandidates.length === 1) {
    return buildResult({
      statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_STATUS_IDS.READY,
      reasonCodes,
      candidate: uniqueCandidates[0],
      candidateCount: 1,
    });
  }

  if (supportedRuleCount === 0) {
    reasonCodes.add(POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.NO_AUTHORITATIVE_RULE);
  }
  if (!structuredMetadataFound) {
    reasonCodes.add(POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.MISSING_STRUCTURED_METADATA);
  }
  if (uniqueCandidates.length > 1) {
    reasonCodes.add(POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS.AMBIGUOUS_CANDIDATE);
  }

  return buildResult({
    statusId: POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_STATUS_IDS.BLOCKED,
    reasonCodes,
    candidateCount: uniqueCandidates.length,
  });
}

export {
  POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_REASON_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_STATUS_IDS,
  POLICY_RUNTIME_DESTINATION_EVIDENCE_CANDIDATE_VERSION,
  buildPolicyRuntimeDestinationEvidenceCandidate,
  listAffirmativeRuleValues,
  listStructuredMetadataValues,
};
