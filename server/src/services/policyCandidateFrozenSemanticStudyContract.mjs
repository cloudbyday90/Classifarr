/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PROPOSAL_VERSION =
  'policy.candidate_frozen_semantic_study_proposal.v1';
export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PREFLIGHT_REPORT_VERSION =
  'policy.candidate_frozen_semantic_study_preflight_report.v1';

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_STATUS_IDS = Object.freeze({
  INVALID_STUDY: 'invalid_study',
  NOT_READY: 'not_ready',
  READY_FOR_HUMAN_STUDY_REVIEW: 'ready_for_human_study_review',
});

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_BLOCKER_IDS = Object.freeze({
  PROPOSAL_BUNDLE_MISMATCH: 'proposal_bundle_mismatch',
  PROPOSAL_EXPIRED: 'proposal_expired',
  PROPOSAL_NOT_ACTIVE: 'proposal_not_active',
  PROPOSAL_INVALID: 'proposal_invalid',
  SEMANTIC_READINESS_INVALID: 'semantic_readiness_invalid',
  SEMANTIC_READINESS_NOT_READY: 'semantic_readiness_not_ready',
});

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_SCOPE_IDS = Object.freeze({
  ACCESS: 'authorized_time_bounded_review',
  CANDIDATE_RETRIEVAL: 'policy_owned_current_library_candidates',
  MODEL_OUTPUT: 'advisory_candidate_comparison',
});

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_AUTHORITY = Object.freeze({
  scope: 'offline_frozen_study_preflight',
  automaticActions: Object.freeze({
    aiInvocation: false,
    learning: false,
    policyChange: false,
    ragQuery: false,
    retry: false,
    routing: false,
  }),
});

export const POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS = Object.freeze({
  INVALID_DOCUMENT: 'invalid_document',
  INVALID_FINGERPRINT: 'invalid_fingerprint',
  INVALID_SCOPE: 'invalid_scope',
  INVALID_STUDY_ID: 'invalid_study_id',
  INVALID_TIMESTAMP: 'invalid_timestamp',
  INVALID_VERSION: 'invalid_version',
  INVALID_WINDOW: 'invalid_window',
  MISSING_REQUIRED_FIELD: 'missing_required_field',
  UNKNOWN_FIELD: 'unknown_field',
});

const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const STUDY_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/u;
const MAXIMUM_STUDY_WINDOW_MILLISECONDS = 31 * 24 * 60 * 60 * 1000;

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function issue(riskId, path, message) {
  return Object.freeze({ riskId, path, message });
}

function requireOwnField(value, key, issues) {
  if (Object.hasOwn(value, key)) return true;
  issues.push(issue(
    POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.MISSING_REQUIRED_FIELD,
    `proposal.${key}`,
    'Field is required by the frozen semantic-study proposal contract.',
  ));
  return false;
}

function validateTimestamp(value, path, issues) {
  if (typeof value !== 'string') {
    issues.push(issue(
      POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_TIMESTAMP,
      path,
      'Timestamp must be a canonical UTC ISO-8601 string.',
    ));
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    issues.push(issue(
      POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_TIMESTAMP,
      path,
      'Timestamp must be a canonical UTC ISO-8601 string.',
    ));
    return null;
  }
  return parsed;
}

function validateFingerprint(value, path, issues) {
  if (typeof value === 'string' && FINGERPRINT_PATTERN.test(value)) return;
  issues.push(issue(
    POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_FINGERPRINT,
    path,
    'Fingerprint must be a lower-case SHA-256 content address.',
  ));
}

/**
 * Validates a content-free proposal that freezes exactly one independently
 * reviewed bundle and the opaque proposal-cohort marker observed at runtime.
 */
export function validatePolicyCandidateFrozenSemanticStudyProposal(proposal) {
  const issues = [];
  if (!isPlainRecord(proposal)) {
    return {
      ok: false,
      issues: [issue(
        POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_DOCUMENT,
        'proposal',
        'Frozen semantic-study proposal must be a plain JSON object.',
      )],
    };
  }

  const allowedKeys = [
    'accessScopeId',
    'candidateRetrievalScopeId',
    'fixtureDocumentFingerprint',
    'modelOutputScopeId',
    'proposalCohortFingerprint',
    'referenceSetDocumentFingerprint',
    'semanticSnapshotManifestFingerprint',
    'snapshotDocumentFingerprint',
    'studyId',
    'studyWindow',
    'version',
  ];
  for (const key of Object.keys(proposal)) {
    if (!allowedKeys.includes(key)) {
      issues.push(issue(
        POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.UNKNOWN_FIELD,
        `proposal.${key}`,
        'Field is not allowed by the frozen semantic-study proposal contract.',
      ));
    }
  }

  const requiredFields = [
    'accessScopeId',
    'candidateRetrievalScopeId',
    'fixtureDocumentFingerprint',
    'modelOutputScopeId',
    'proposalCohortFingerprint',
    'referenceSetDocumentFingerprint',
    'semanticSnapshotManifestFingerprint',
    'snapshotDocumentFingerprint',
    'studyId',
    'studyWindow',
    'version',
  ];
  const present = Object.fromEntries(requiredFields.map((key) => [
    key,
    requireOwnField(proposal, key, issues),
  ]));

  if (present.version && proposal.version !== POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_PROPOSAL_VERSION) {
    issues.push(issue(
      POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_VERSION,
      'proposal.version',
      'Proposal must declare the current frozen semantic-study proposal version.',
    ));
  }
  if (present.studyId && (typeof proposal.studyId !== 'string' || !STUDY_ID_PATTERN.test(proposal.studyId))) {
    issues.push(issue(
      POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_STUDY_ID,
      'proposal.studyId',
      'Study ID must be a lower-case bounded identifier.',
    ));
  }

  for (const [key, expected] of [
    ['accessScopeId', POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_SCOPE_IDS.ACCESS],
    ['candidateRetrievalScopeId', POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_SCOPE_IDS.CANDIDATE_RETRIEVAL],
    ['modelOutputScopeId', POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_SCOPE_IDS.MODEL_OUTPUT],
  ]) {
    if (present[key] && proposal[key] !== expected) {
      issues.push(issue(
        POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_SCOPE,
        `proposal.${key}`,
        'Proposal must declare the fixed frozen-study scope.',
      ));
    }
  }

  for (const key of [
    'fixtureDocumentFingerprint',
    'proposalCohortFingerprint',
    'referenceSetDocumentFingerprint',
    'semanticSnapshotManifestFingerprint',
    'snapshotDocumentFingerprint',
  ]) {
    if (present[key]) validateFingerprint(proposal[key], `proposal.${key}`, issues);
  }

  if (present.studyWindow) {
    const window = proposal.studyWindow;
    if (!isPlainRecord(window) || Object.keys(window).some((key) => (
      key !== 'expiresAt' && key !== 'startsAt'
    ))) {
      issues.push(issue(
        POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_WINDOW,
        'proposal.studyWindow',
        'Study window must contain only startsAt and expiresAt.',
      ));
    } else {
      const start = Object.hasOwn(window, 'startsAt')
        ? validateTimestamp(window.startsAt, 'proposal.studyWindow.startsAt', issues)
        : null;
      const end = Object.hasOwn(window, 'expiresAt')
        ? validateTimestamp(window.expiresAt, 'proposal.studyWindow.expiresAt', issues)
        : null;
      if (!Object.hasOwn(window, 'startsAt') || !Object.hasOwn(window, 'expiresAt')) {
        issues.push(issue(
          POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.MISSING_REQUIRED_FIELD,
          'proposal.studyWindow',
          'Study window requires startsAt and expiresAt.',
        ));
      } else if (start && end && (end.getTime() <= start.getTime() ||
          end.getTime() - start.getTime() > MAXIMUM_STUDY_WINDOW_MILLISECONDS)) {
        issues.push(issue(
          POLICY_CANDIDATE_FROZEN_SEMANTIC_STUDY_RISK_IDS.INVALID_WINDOW,
          'proposal.studyWindow',
          'Study window must be positive and no longer than 31 days.',
        ));
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
