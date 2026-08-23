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
  AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION,
  isAiClassificationEvaluationPolicyContext,
} from '../../server/src/services/aiClassificationEvaluationPolicyContext.mjs';
import {
  validateAiPolicySweepFixtureDocument,
} from './aiPolicySweepFixtureDocument.mjs';

const AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION =
  'classifarr.ai_policy_sweep_fixture_profile.v1';
const SHA256_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_PROFILE_FIXTURES = 32;
const PROFILE_FIELDS = Object.freeze(['fixtures', 'policyContext', 'version']);

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function buildIssue(id, path, message) {
  return { id, path, message };
}

function hasOnlyProfileFields(value, issues) {
  if (!isPlainRecord(value)) {
    issues.push(buildIssue('invalid_fixture_profile', 'profile', 'Fixture profile must be a JSON object.'));
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!PROFILE_FIELDS.includes(key)) {
      issues.push(buildIssue('unknown_fixture_profile_field', `profile.${key}`, 'Field is not supported by the fixture profile contract.'));
    }
  }
  return true;
}

function validatePolicyContextFingerprint(value, issues) {
  const path = 'profile.policyContext';
  if (!isPlainRecord(value)) {
    issues.push(buildIssue('invalid_profile_policy_context', path, 'Policy context must be a JSON object.'));
    return;
  }
  const allowedFields = ['algorithm', 'fingerprint', 'version'];
  for (const key of Object.keys(value)) {
    if (!allowedFields.includes(key)) {
      issues.push(buildIssue('unknown_profile_policy_context_field', `${path}.${key}`, 'Field is not supported by the policy-context fingerprint contract.'));
    }
  }
  if (value.version !== AI_CLASSIFICATION_EVALUATION_POLICY_CONTEXT_VERSION) {
    issues.push(buildIssue('invalid_profile_policy_context_version', `${path}.version`, 'Policy context must use the current evaluation-context version.'));
  }
  if (value.algorithm !== 'sha256') {
    issues.push(buildIssue('invalid_profile_policy_context_algorithm', `${path}.algorithm`, 'Policy context fingerprint algorithm must be sha256.'));
  }
  if (typeof value.fingerprint !== 'string' || !SHA256_FINGERPRINT_PATTERN.test(value.fingerprint)) {
    issues.push(buildIssue('invalid_profile_policy_context_fingerprint', `${path}.fingerprint`, 'Policy context fingerprint must be 64 lowercase hexadecimal characters.'));
  }
}

function validateAiPolicySweepFixtureProfile(profile) {
  const issues = [];
  const isRecord = hasOnlyProfileFields(profile, issues);
  if (!isRecord) {
    return { fixtureCount: 0, issues, ok: false };
  }

  if (profile.version !== AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION) {
    issues.push(buildIssue('invalid_fixture_profile_version', 'profile.version', 'Fixture profile must declare the current profile contract version.'));
  }
  validatePolicyContextFingerprint(profile.policyContext, issues);

  if (!Array.isArray(profile.fixtures) || profile.fixtures.length === 0 ||
    profile.fixtures.length > MAX_PROFILE_FIXTURES) {
    issues.push(buildIssue('invalid_profile_fixture_count', 'profile.fixtures', `Fixture profile must contain 1 to ${MAX_PROFILE_FIXTURES} fixtures.`));
  } else {
    const fixtureValidation = validateAiPolicySweepFixtureDocument(profile.fixtures);
    for (const issue of fixtureValidation.issues) {
      issues.push(buildIssue(issue.id, `profile.${issue.path}`, issue.message));
    }
  }

  return {
    fixtureCount: Array.isArray(profile.fixtures) ? profile.fixtures.length : 0,
    issues,
    ok: issues.length === 0,
  };
}

function appendAiPolicySweepFixtureProfile({ fixtureDocument, profile } = {}) {
  if (!Array.isArray(fixtureDocument)) {
    throw new TypeError('Fixture document must be an array.');
  }
  const validation = validateAiPolicySweepFixtureProfile(profile);
  if (!validation.ok) {
    return { fixtureDocument, profileMetadata: null, validation };
  }

  return {
    fixtureDocument: [...fixtureDocument, ...profile.fixtures],
    profileMetadata: {
      fixtureCount: validation.fixtureCount,
      policyContext: {
        algorithm: profile.policyContext.algorithm,
        fingerprint: profile.policyContext.fingerprint,
        version: profile.policyContext.version,
      },
      version: profile.version,
    },
    validation,
  };
}

function verifyAiPolicySweepFixtureProfileBinding({ profileMetadata, policyContext } = {}) {
  if (!profileMetadata) {
    return { ok: true, reasonId: 'profile_not_configured' };
  }
  if (!isAiClassificationEvaluationPolicyContext(policyContext)) {
    return { ok: false, reasonId: 'active_policy_context_invalid' };
  }

  const expected = profileMetadata.policyContext;
  if (expected.version !== policyContext.version ||
    expected.algorithm !== policyContext.algorithm ||
    expected.fingerprint !== policyContext.fingerprint) {
    return { ok: false, reasonId: 'policy_context_fingerprint_mismatch' };
  }

  return { ok: true, reasonId: 'policy_context_fingerprint_match' };
}

export {
  AI_POLICY_SWEEP_FIXTURE_PROFILE_VERSION,
  appendAiPolicySweepFixtureProfile,
  validateAiPolicySweepFixtureProfile,
  verifyAiPolicySweepFixtureProfileBinding,
};
