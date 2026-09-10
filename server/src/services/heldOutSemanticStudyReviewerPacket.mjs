/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { randomBytes } from 'node:crypto';

import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION =
  'policy.held_out_semantic_study_reviewer_packet.v1';
export const HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_DEFAULT_TTL_MILLISECONDS =
  24 * 60 * 60 * 1000;

const MAX_CASES = 32;
const MAX_OVERVIEW_LENGTH = 2_000;
const MAX_POLICY_TERMS = 12;
const MAX_TERM_LENGTH = 120;
const SUPPORTED_MEDIA_TYPES = new Set(['movie', 'tv']);

function canonicalTimestamp(value) {
  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function boundedText(value, maximumLength) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim();
  return normalized && normalized.length <= maximumLength ? normalized : null;
}

function boundedYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1800 && year <= 9_999 ? year : null;
}

function projectTerms(value, terms = []) {
  if (terms.length >= MAX_POLICY_TERMS || value === null || value === undefined) return terms;
  if (typeof value === 'string') {
    const term = boundedText(value, MAX_TERM_LENGTH);
    if (term && !terms.includes(term)) terms.push(term);
    return terms;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    const term = String(value);
    if (!terms.includes(term)) terms.push(term);
    return terms;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => projectTerms(entry, terms));
    return terms;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).sort().forEach((key) => projectTerms(value[key], terms));
  }
  return terms;
}

function declaredPurpose(policy) {
  const purposeRules = Array.isArray(policy?.policy_intent_contract?.purpose)
    ? policy.policy_intent_contract.purpose
    : [];
  const terms = [];
  for (const rule of purposeRules) projectTerms(rule?.values, terms);
  return Object.freeze(terms);
}

function policiesByLibraryId(policies) {
  if (!Array.isArray(policies)) return null;
  const byLibraryId = new Map();
  for (const policy of policies) {
    const libraryId = Number(policy?.library_id);
    const libraryName = boundedText(policy?.library_name, 160);
    const policyName = boundedText(policy?.name, 160);
    if (!Number.isInteger(libraryId) || libraryId <= 0 || !libraryName || !policyName ||
        byLibraryId.has(libraryId)) return null;
    byLibraryId.set(libraryId, policy);
  }
  return byLibraryId;
}

function candidateId(index) {
  return `candidate_${String.fromCharCode(97 + index)}`;
}

function projectCandidates(contract, policyByLibraryId) {
  const candidates = Array.isArray(contract?.candidates) ? contract.candidates : [];
  if (contract?.valid !== true || candidates.length < 2 || candidates.length > 3) return null;
  const projected = candidates.map((candidate, index) => {
    const policy = policyByLibraryId.get(Number(candidate?.libraryId));
    const libraryName = boundedText(policy?.library_name, 160);
    const policyName = boundedText(policy?.name, 160);
    if (!policy || !libraryName || !policyName) return null;
    return Object.freeze({
      candidateId: candidateId(index),
      declaredPurpose: declaredPurpose(policy),
      libraryName,
      policyName,
    });
  });
  return projected.includes(null) ? null : Object.freeze(projected);
}

function projectMedia(metadata) {
  const mediaType = typeof metadata?.media_type === 'string'
    ? metadata.media_type.trim().toLowerCase()
    : null;
  const title = boundedText(metadata?.title, 220);
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType) || !title) return null;
  const genres = Array.isArray(metadata?.genres)
    ? metadata.genres.map((genre) => boundedText(genre, 80)).filter(Boolean).slice(0, MAX_POLICY_TERMS)
    : [];
  const overview = boundedText(metadata?.overview, MAX_OVERVIEW_LENGTH);
  return Object.freeze({
    genres: Object.freeze(genres),
    mediaType,
    overview,
    title,
    year: boundedYear(metadata?.year),
  });
}

function caseByFixtureId(privateReviewCases) {
  if (!Array.isArray(privateReviewCases) || privateReviewCases.length < 24 ||
      privateReviewCases.length > MAX_CASES) return null;
  const byFixtureId = new Map();
  for (const studyCase of privateReviewCases) {
    const fixtureId = typeof studyCase?.fixtureId === 'string' ? studyCase.fixtureId : null;
    if (!fixtureId || byFixtureId.has(fixtureId)) return null;
    byFixtureId.set(fixtureId, studyCase);
  }
  return byFixtureId;
}

function buildPacketId(random) {
  const entropy = random(32);
  return Buffer.isBuffer(entropy) && entropy.length === 32
    ? `review_packet_${entropy.toString('hex')}`
    : null;
}

function instructions() {
  return Object.freeze({
    abstain: 'Choose abstain when the supplied case information cannot support a defensible choice.',
    admit: 'Choose admit when Candidate A is the appropriate declared destination for this case.',
    independence: 'Do not consult semantic retrieval, RAG output, model output, or existing placement while labelling.',
    review: 'Choose review when another listed candidate requires a routing review instead of Candidate A.',
  });
}

/**
 * Creates one content-bearing, local-only packet for an independently labelled
 * held-out study. It carries source media and declared policy context but never
 * carries retrieval results, vectors, scores, prompts, model output, current
 * placement, or a proposed reference label.
 */
export function buildHeldOutSemanticStudyReviewerPacket({
  bundle,
  now = new Date(),
  policies,
  privateReviewCases,
  random = randomBytes,
  selected,
  ttlMilliseconds = HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_DEFAULT_TTL_MILLISECONDS,
} = {}) {
  const startsAt = canonicalTimestamp(now);
  const expiresAt = canonicalTimestamp(new Date(new Date(now).getTime() + ttlMilliseconds));
  const fixtureDocument = bundle?.fixtureDocument;
  const fixtureDocumentFingerprint = Array.isArray(fixtureDocument)
    ? createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument)
    : null;
  const policyByLibraryId = policiesByLibraryId(policies);
  const casesByFixtureId = caseByFixtureId(privateReviewCases);
  if (!startsAt || !expiresAt || !fixtureDocumentFingerprint || !policyByLibraryId || !casesByFixtureId ||
      !Array.isArray(selected) || selected.length !== fixtureDocument.length ||
      !Number.isInteger(ttlMilliseconds) || ttlMilliseconds < 60_000 ||
      ttlMilliseconds > HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_DEFAULT_TTL_MILLISECONDS) return null;

  const fixtureIds = new Set();
  const cases = [];
  for (const selection of selected) {
    const fixtureId = typeof selection?.fixtureId === 'string' ? selection.fixtureId : null;
    const studyCase = fixtureId ? casesByFixtureId.get(fixtureId) : null;
    const media = projectMedia(studyCase?.metadata);
    const candidates = projectCandidates(studyCase?.contract, policyByLibraryId);
    if (!fixtureId || fixtureIds.has(fixtureId) || !media || !candidates) return null;
    fixtureIds.add(fixtureId);
    cases.push(Object.freeze({ candidates, fixtureId, media }));
  }
  if (fixtureIds.size !== fixtureDocument.length) return null;

  const packetId = buildPacketId(random);
  if (!packetId) return null;
  return Object.freeze({
    cases: Object.freeze(cases),
    fixtureDocumentFingerprint,
    instructions: instructions(),
    packetId,
    studyWindow: Object.freeze({ expiresAt, startsAt }),
    version: HELD_OUT_SEMANTIC_STUDY_REVIEWER_PACKET_VERSION,
  });
}
