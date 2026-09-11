/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  createPolicyCandidateSemanticSnapshotFingerprint,
} from './policyCandidateSemanticSnapshotFingerprint.mjs';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_VERSION =
  'policy.held_out_semantic_study_retrieval_representation_scoring_input.v1';

export const HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS = Object.freeze({
  DUPLICATE_CANDIDATE_ID: 'duplicate_candidate_id',
  DUPLICATE_LIBRARY_ID: 'duplicate_library_id',
  DUPLICATE_FIXTURE_ID: 'duplicate_fixture_id',
  FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH: 'fixture_document_fingerprint_mismatch',
  INCOMPLETE_FIXTURE_SET: 'incomplete_fixture_set',
  INVALID_CANDIDATE: 'invalid_candidate',
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_METADATA: 'invalid_metadata',
  INVALID_VERSION: 'invalid_version',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH: 'snapshot_document_fingerprint_mismatch',
  UNKNOWN_FIELD: 'unknown_field',
});

const INPUT_KEYS = Object.freeze([
  'cases',
  'fixtureDocumentFingerprint',
  'snapshotDocumentFingerprint',
  'version',
]);
const CASE_KEYS = Object.freeze(['candidates', 'fixtureId', 'metadata']);
const CANDIDATE_KEYS = Object.freeze(['candidateId', 'declaredPurposeTerms', 'libraryId']);
const METADATA_KEYS = new Set([
  'certification', 'genres', 'keywords', 'media_type', 'original_language', 'overview',
  'production_companies', 'rating', 'title', 'tmdb_id', 'year',
]);
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const CANDIDATE_ID_PATTERN = /^candidate_[a-c]$/u;
const MAX_CASES = 32;
const MIN_CASES = 24;
const MAX_METADATA_BYTES = 12 * 1024;
const MAX_PURPOSE_TERMS = 12;
const MAX_PURPOSE_TERM_LENGTH = 120;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function requireField(value, key, path, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.MISSING_REQUIRED_FIELD,
    `${path}.${key}`,
    'Field is required by the private scoring input.',
  ));
  return false;
}

function hasExactKeys(value, keys, path, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_DOCUMENT,
      path,
      'Value must be a plain JSON object.',
    ));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.UNKNOWN_FIELD,
        `${path}.${key}`,
        'Field is not allowed by the private scoring input.',
      ));
    }
  }
  for (const key of keys) requireField(value, key, path, issues);
  return true;
}

function canonicalJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function boundedMetadata(value) {
  if (!isPlainRecord(value) || Object.keys(value).some((key) => !METADATA_KEYS.has(key))) return null;
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 220 ||
      !['movie', 'tv'].includes(value.media_type) ||
      !Number.isInteger(value.tmdb_id) || value.tmdb_id <= 0 || value.tmdb_id > 2_147_483_647) {
    return null;
  }
  const source = canonicalJson(value);
  if (!source || Buffer.byteLength(source) > MAX_METADATA_BYTES) return null;
  try {
    return Object.freeze(JSON.parse(source));
  } catch {
    return null;
  }
}

function normalizeTerms(value) {
  if (!Array.isArray(value) || value.length > MAX_PURPOSE_TERMS) return null;
  const terms = [];
  for (const entry of value) {
    if (typeof entry !== 'string') return null;
    const normalized = entry.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim();
    if (!normalized || normalized.length > MAX_PURPOSE_TERM_LENGTH || terms.includes(normalized)) return null;
    terms.push(normalized);
  }
  return Object.freeze(terms);
}

function validateCandidate(candidate, path, issues) {
  if (!hasExactKeys(candidate, CANDIDATE_KEYS, path, issues)) return null;
  const candidateId = candidate.candidateId;
  const libraryId = Number(candidate.libraryId);
  const terms = normalizeTerms(candidate.declaredPurposeTerms);
  if (typeof candidateId !== 'string' || !CANDIDATE_ID_PATTERN.test(candidateId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_CANDIDATE,
      `${path}.candidateId`,
      'Candidate ID must be an opaque, bounded server-assigned identifier.',
    ));
  }
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_CANDIDATE,
      `${path}.libraryId`,
      'Candidate library ID must be a positive integer.',
    ));
  }
  if (!terms) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_CANDIDATE,
      `${path}.declaredPurposeTerms`,
      'Declared-purpose terms must be a bounded, unique string list.',
    ));
  }
  return candidateId && Number.isInteger(libraryId) && terms
    ? Object.freeze({ candidateId, declaredPurposeTerms: terms, libraryId })
    : null;
}

function validateCase(studyCase, index, issues) {
  const path = `scoringInput.cases[${index}]`;
  if (!hasExactKeys(studyCase, CASE_KEYS, path, issues)) return null;
  const fixtureId = studyCase.fixtureId;
  if (typeof fixtureId !== 'string' || !FIXTURE_ID_PATTERN.test(fixtureId)) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_DOCUMENT,
      `${path}.fixtureId`,
      'Fixture ID must be a bounded opaque study identifier.',
    ));
  }
  const metadata = boundedMetadata(studyCase.metadata);
  if (!metadata) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_METADATA,
      `${path}.metadata`,
      'Metadata must be a bounded, recognized held-out media record.',
    ));
  }
  const rawCandidates = studyCase.candidates;
  if (!Array.isArray(rawCandidates) || rawCandidates.length < 2 || rawCandidates.length > 3) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_CANDIDATE,
      `${path}.candidates`,
      'Each scoring case requires two or three server-owned candidates.',
    ));
    return null;
  }
  const candidates = rawCandidates.map((candidate, candidateIndex) => (
    validateCandidate(candidate, `${path}.candidates[${candidateIndex}]`, issues)
  ));
  const candidateIds = new Set();
  const libraryIds = new Set();
  candidates.forEach((candidate, candidateIndex) => {
    if (candidate && candidateIds.has(candidate.candidateId)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.DUPLICATE_CANDIDATE_ID,
        `${path}.candidates[${candidateIndex}].candidateId`,
        'Candidate IDs must be unique within a scoring case.',
      ));
    }
    if (candidate) candidateIds.add(candidate.candidateId);
    if (candidate && libraryIds.has(candidate.libraryId)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.DUPLICATE_LIBRARY_ID,
        `${path}.candidates[${candidateIndex}].libraryId`,
        'Each scoring candidate must refer to a distinct library.',
      ));
    }
    if (candidate) libraryIds.add(candidate.libraryId);
  });
  return fixtureId && metadata && candidates.every(Boolean) && candidateIds.size === candidates.length &&
    libraryIds.size === candidates.length
    ? Object.freeze({ candidates: Object.freeze(candidates), fixtureId, metadata })
    : null;
}

function validateFingerprint(value, path, issues) {
  if (typeof value === 'string' && FINGERPRINT_PATTERN.test(value)) return;
  issues.push(buildIssue(
    HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_FINGERPRINT,
    path,
    'Fingerprint must be a SHA-256 content address.',
  ));
}

/** Validates a private scorer input before it can reach retrieval or an evaluator. */
export function validateHeldOutSemanticStudyRetrievalRepresentationScoringInput(scoringInput) {
  const issues = [];
  if (!hasExactKeys(scoringInput, INPUT_KEYS, 'scoringInput', issues)) {
    return Object.freeze({ cases: Object.freeze([]), issues: Object.freeze(issues), ok: false });
  }
  if (scoringInput.version !== HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_VERSION) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_VERSION,
      'scoringInput.version',
      'Scoring input must declare the current version.',
    ));
  }
  validateFingerprint(scoringInput.fixtureDocumentFingerprint, 'scoringInput.fixtureDocumentFingerprint', issues);
  validateFingerprint(scoringInput.snapshotDocumentFingerprint, 'scoringInput.snapshotDocumentFingerprint', issues);
  const sourceCases = scoringInput.cases;
  if (!Array.isArray(sourceCases) || sourceCases.length < MIN_CASES || sourceCases.length > MAX_CASES) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INVALID_DOCUMENT,
      'scoringInput.cases',
      `Scoring input requires between ${MIN_CASES} and ${MAX_CASES} cases.`,
    ));
    return Object.freeze({ cases: Object.freeze([]), issues: Object.freeze(issues), ok: false });
  }
  const cases = sourceCases.map((studyCase, index) => validateCase(studyCase, index, issues));
  const fixtureIds = new Set();
  cases.forEach((studyCase, index) => {
    if (studyCase && fixtureIds.has(studyCase.fixtureId)) {
      issues.push(buildIssue(
        HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.DUPLICATE_FIXTURE_ID,
        `scoringInput.cases[${index}].fixtureId`,
        'Fixture IDs must be unique within one scoring input.',
      ));
    }
    if (studyCase) fixtureIds.add(studyCase.fixtureId);
  });
  return Object.freeze({
    cases: Object.freeze(cases.filter(Boolean)),
    issues: Object.freeze(issues),
    ok: issues.length === 0,
  });
}

/** Binds a valid private scoring input to the redacted evaluation bundle. */
export function validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding({
  fixtureDocument,
  scoringInput,
  snapshotDocument,
} = {}) {
  const input = validateHeldOutSemanticStudyRetrievalRepresentationScoringInput(scoringInput);
  const issues = [...input.issues];
  if (!input.ok || !Array.isArray(fixtureDocument) || !snapshotDocument) {
    return Object.freeze({ issues: Object.freeze(issues), ok: false });
  }
  const fixtureFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(fixtureDocument);
  const snapshotFingerprint = createPolicyCandidateSemanticSnapshotFingerprint(snapshotDocument);
  if (scoringInput.fixtureDocumentFingerprint !== fixtureFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS
        .FIXTURE_DOCUMENT_FINGERPRINT_MISMATCH,
      'scoringInput.fixtureDocumentFingerprint',
      'Scoring input is not pinned to the redacted fixture document.',
    ));
  }
  if (scoringInput.snapshotDocumentFingerprint !== snapshotFingerprint) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS
        .SNAPSHOT_DOCUMENT_FINGERPRINT_MISMATCH,
      'scoringInput.snapshotDocumentFingerprint',
      'Scoring input is not pinned to the fixed retrieval snapshot document.',
    ));
  }
  const expectedFixtureIds = new Set(fixtureDocument.map((fixture) => fixture?.id));
  const actualFixtureIds = new Set(input.cases.map((studyCase) => studyCase.fixtureId));
  if (expectedFixtureIds.size !== actualFixtureIds.size ||
      [...expectedFixtureIds].some((fixtureId) => !actualFixtureIds.has(fixtureId))) {
    issues.push(buildIssue(
      HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_RISK_IDS.INCOMPLETE_FIXTURE_SET,
      'scoringInput.cases',
      'Scoring input must contain exactly the pinned fixture set.',
    ));
  }
  return Object.freeze({ issues: Object.freeze(issues), ok: issues.length === 0 });
}

function termsFromPurpose(value, terms = []) {
  if (terms.length >= MAX_PURPOSE_TERMS || value === null || value === undefined) return terms;
  if (typeof value === 'string') {
    const normalized = value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim();
    if (normalized && normalized.length <= MAX_PURPOSE_TERM_LENGTH && !terms.includes(normalized)) terms.push(normalized);
    return terms;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => termsFromPurpose(entry, terms));
  } else if (value && typeof value === 'object') {
    Object.keys(value).sort().forEach((key) => termsFromPurpose(value[key], terms));
  }
  return terms;
}

function policyByLibraryId(policies) {
  if (!Array.isArray(policies)) return null;
  const result = new Map();
  for (const policy of policies) {
    const libraryId = Number(policy?.library_id);
    if (!Number.isInteger(libraryId) || libraryId <= 0 || result.has(libraryId)) return null;
    result.set(libraryId, policy);
  }
  return result;
}

function candidatesFromContract(contract, policies) {
  if (contract?.valid !== true || !Array.isArray(contract.candidates) ||
      contract.candidates.length < 2 || contract.candidates.length > 3) return null;
  const candidates = contract.candidates.map((candidate, index) => {
    const libraryId = Number(candidate?.libraryId);
    const policy = policies.get(libraryId);
    const declaredPurposeTerms = [];
    const purposeRules = Array.isArray(policy?.policy_intent_contract?.purpose)
      ? policy.policy_intent_contract.purpose
      : [];
    purposeRules.forEach((rule) => termsFromPurpose(rule?.values, declaredPurposeTerms));
    return policy && Number.isInteger(libraryId) && libraryId > 0
      ? Object.freeze({
        candidateId: `candidate_${String.fromCharCode(97 + index)}`,
        declaredPurposeTerms: Object.freeze(declaredPurposeTerms),
        libraryId,
      })
      : null;
  });
  return candidates.includes(null) ? null : Object.freeze(candidates);
}

/**
 * Creates an in-memory, private scorer input during the same capture that
 * generated the pinned cohort. It contains no reviewer label, retrieval text,
 * provider output, or model configuration.
 */
export function buildHeldOutSemanticStudyRetrievalRepresentationScoringInput({
  bundle,
  policies,
  privateReviewCases,
} = {}) {
  if (!Array.isArray(bundle?.fixtureDocument) || !bundle?.snapshotDocument ||
      !Array.isArray(privateReviewCases) || privateReviewCases.length !== bundle.fixtureDocument.length) return null;
  const policiesByLibraryId = policyByLibraryId(policies);
  if (!policiesByLibraryId) return null;
  const casesByFixtureId = new Map(privateReviewCases.map((studyCase) => [studyCase?.fixtureId, studyCase]));
  if (casesByFixtureId.size !== privateReviewCases.length) return null;
  const cases = bundle.fixtureDocument.map((fixture) => {
    const studyCase = casesByFixtureId.get(fixture?.id);
    const metadata = boundedMetadata(studyCase?.metadata);
    const candidates = candidatesFromContract(studyCase?.contract, policiesByLibraryId);
    return studyCase && metadata && candidates
      ? Object.freeze({ candidates, fixtureId: fixture.id, metadata })
      : null;
  });
  if (cases.includes(null)) return null;
  const scoringInput = Object.freeze({
    cases: Object.freeze(cases),
    fixtureDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.fixtureDocument),
    snapshotDocumentFingerprint: createPolicyCandidateSemanticSnapshotFingerprint(bundle.snapshotDocument),
    version: HELD_OUT_SEMANTIC_STUDY_RETRIEVAL_REPRESENTATION_SCORING_INPUT_VERSION,
  });
  return validateHeldOutSemanticStudyRetrievalRepresentationScoringInputBinding({
    fixtureDocument: bundle.fixtureDocument,
    scoringInput,
    snapshotDocument: bundle.snapshotDocument,
  }).ok ? scoringInput : null;
}
