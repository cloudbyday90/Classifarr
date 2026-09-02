/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { createHash } from 'node:crypto';

import {
  AI_PROVIDER_AUTHORITY_CONTRACT_VERSION,
  AI_PROVIDER_AUTHORITY_MODE_IDS,
} from './aiProviderAuthority.mjs';
import {
  CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
} from './currentLibraryCandidateSemanticRetrievalContract.mjs';

export const POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION =
  'policy.candidate_semantic_adjudication_proposal.v1';

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const PROVIDER_ID_PATTERN = /^[a-z0-9_-]{1,32}$/u;
const MODEL_ID_MAXIMUM_LENGTH = 255;
const CANDIDATE_COUNT_MINIMUM = 2;
const CANDIDATE_COUNT_MAXIMUM = 3;
const SEMANTIC_RETRIEVAL_STATUS_IDS = new Set(['available', 'unavailable']);
const AUTHORITY_MODE_IDS = new Set(Object.values(AI_PROVIDER_AUTHORITY_MODE_IDS));

function boundedModelId(value) {
  if (typeof value !== 'string') return null;

  const normalized = value.replace(/[\r\n\t]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length <= MODEL_ID_MAXIMUM_LENGTH ? normalized : null;
}

function normalizeCandidateCount(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) &&
    numericValue >= CANDIDATE_COUNT_MINIMUM &&
    numericValue <= CANDIDATE_COUNT_MAXIMUM
    ? numericValue
    : null;
}

function normalizeProviderAuthority(value) {
  const providerId = typeof value?.providerId === 'string'
    ? value.providerId.trim().toLowerCase()
    : null;
  const model = boundedModelId(value?.model);
  const effectiveMode = value?.effectiveMode;
  const providerEnforcedStructuredOutput =
    value?.capabilities?.providerEnforcedStructuredOutput;

  if (value?.version !== AI_PROVIDER_AUTHORITY_CONTRACT_VERSION ||
      !providerId || !PROVIDER_ID_PATTERN.test(providerId) || !model ||
      !AUTHORITY_MODE_IDS.has(effectiveMode) ||
      typeof providerEnforcedStructuredOutput !== 'boolean') {
    return null;
  }

  return Object.freeze({
    providerEnforcedStructuredOutput,
    effectiveMode,
    model,
    providerId,
  });
}

function canonicalProposalDescriptor({ authority, candidateCount, semanticRetrievalStatusId }) {
  const normalizedAuthority = normalizeProviderAuthority(authority);
  const normalizedCandidateCount = normalizeCandidateCount(candidateCount);

  if (!normalizedAuthority || !normalizedCandidateCount ||
      !SEMANTIC_RETRIEVAL_STATUS_IDS.has(semanticRetrievalStatusId)) {
    return null;
  }

  return Object.freeze({
    authority: normalizedAuthority,
    candidateAdjudicationCandidateCount: normalizedCandidateCount,
    candidateAdjudicationContractVersion: 'policy.candidate_adjudication.v1',
    semanticRetrievalProtocolVersion: CURRENT_LIBRARY_CANDIDATE_SEMANTIC_RETRIEVAL_VERSION,
    version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
  });
}

/**
 * Builds a server-only, content-free cohort marker for one candidate
 * adjudication proposal. The hash excludes metadata, library IDs/names,
 * prompts, responses, embeddings, provider hosts, and credentials.
 */
export function createPolicyCandidateSemanticAdjudicationProposalFingerprint({
  authority = null,
  candidateCount = null,
  semanticRetrievalStatusId = null,
} = {}) {
  const descriptor = canonicalProposalDescriptor({
    authority,
    candidateCount,
    semanticRetrievalStatusId,
  });
  if (!descriptor) return null;

  return Object.freeze({
    fingerprint: createHash('sha256').update(JSON.stringify(descriptor)).digest('hex'),
    version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
  });
}

/** Validates the only immutable proposal-cohort marker that may persist. */
export function buildPolicyCandidateSemanticAdjudicationProposalProjection(value = {}) {
  if (value?.version !== POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION ||
      typeof value?.fingerprint !== 'string' || !FINGERPRINT_PATTERN.test(value.fingerprint)) {
    return null;
  }

  return Object.freeze({
    fingerprint: value.fingerprint,
    version: POLICY_CANDIDATE_SEMANTIC_ADJUDICATION_PROPOSAL_VERSION,
  });
}
