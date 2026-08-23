/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash } from 'node:crypto';

import {
  POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS,
  POLICY_RELEASE_ACCEPTANCE_MODE_IDS,
  POLICY_RELEASE_ACCEPTANCE_STATUS_IDS,
  validatePolicyReleaseAcceptanceReadout,
} from '../../server/src/services/policyReleaseAcceptanceManifest.mjs';
import {
  EXPECTED_RELEASE_REPOSITORY,
  EXPECTED_SIGNER_WORKFLOW,
  PUBLISHED_DIGEST_CONSUMER_SMOKE_SCHEMA_VERSION,
  PUBLISHED_IMAGE_REPOSITORIES,
  assertSourceRevision,
  parsePublishedImageReference,
} from './publishedDigestConsumerSmoke.mjs';
import {
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_FINGERPRINT_ALGORITHM,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION,
  AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT,
  createAiProviderFaultComposeReceiptFingerprint,
  validateAiProviderFaultComposeReceipt,
} from './aiProviderFaultComposeReceipt.mjs';

export const RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION =
  'classifarr.release.candidate-evidence.v2';
export const LEGACY_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION =
  'classifarr.release.candidate-evidence.v1';

export const RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS = Object.freeze({
  CI_ACCEPTANCE_INVALID: 'ci_acceptance_invalid',
  CONSUMER_SMOKE_INVALID: 'consumer_smoke_invalid',
  EVIDENCE_INVALID: 'evidence_invalid',
  INVALID_INPUT: 'invalid_input',
  PROVIDER_FAULT_RECEIPT_INVALID: 'provider_fault_receipt_invalid',
});

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+(?:[a-z0-9]+)?(?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?$/u;
const FINGERPRINT_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const EXPECTED_CONSUMER_SMOKE_CHECKS = Object.freeze({
  compose_configuration: 'validated',
  compose_startup: 'healthy',
  migration_readiness: 'ready',
  provenance: 'verified',
  runtime_health: 'healthy',
  teardown: 'completed',
});
const REQUIRED_CI_COMPONENT_IDS = Object.freeze([
  POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.REPOSITORY_VALIDATION,
  POLICY_RELEASE_ACCEPTANCE_COMPONENT_IDS.ISOLATED_RUNTIME_ACCEPTANCE,
]);
const LEGACY_EVIDENCE_KEYS = Object.freeze([
  'ci_acceptance',
  'consumer_smoke',
  'evidence_fingerprint',
  'generated_at',
  'images',
  'schema_version',
  'source_repository',
  'source_revision',
  'tag',
]);
const CURRENT_EVIDENCE_KEYS = Object.freeze([
  ...LEGACY_EVIDENCE_KEYS,
  'provider_fault_receipt',
]);
const CI_ACCEPTANCE_KEYS = Object.freeze([
  'generatedAt',
  'requiredComponentIds',
  'version',
]);
const CONSUMER_SMOKE_KEYS = Object.freeze([
  'checks',
  'completedAt',
  'image',
]);
const IMAGE_KEYS = Object.freeze(['dockerHub', 'ghcr']);
const FINGERPRINT_KEYS = Object.freeze(['algorithm', 'value']);
const PROVIDER_FAULT_RECEIPT_SUMMARY_KEYS = Object.freeze([
  'completedAt',
  'outcome',
  'receiptFingerprint',
  'schemaVersion',
  'sourceRevision',
  'statusId',
  'testContract',
]);

export class ReleaseCandidateEvidenceError extends Error {
  constructor(statusId) {
    super(`Release candidate evidence failed: ${statusId}.`);
    this.name = 'ReleaseCandidateEvidenceError';
    this.statusId = statusId;
  }
}

function throwStatus(statusId) {
  throw new ReleaseCandidateEvidenceError(statusId);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expectedKeys) {
  if (!isRecord(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index]);
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertReleaseTag(tag) {
  if (typeof tag !== 'string' || !RELEASE_TAG_PATTERN.test(tag)) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  }
  return tag;
}

function assertDigest(digest) {
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest.toLowerCase())) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  }
  return digest.toLowerCase();
}

function getRequiredCiComponents(readout) {
  if (!Array.isArray(readout.components)) {
    return [];
  }

  return REQUIRED_CI_COMPONENT_IDS.map(componentId => readout.components.find(component =>
    component?.componentId === componentId && component.required === true
  ) || null);
}

function assertCiReadout({ ciReadout, sourceRevision }) {
  const validation = validatePolicyReleaseAcceptanceReadout(ciReadout);
  const requiredComponents = getRequiredCiComponents(ciReadout);
  const valid = validation.ok === true &&
    ciReadout?.modeId === POLICY_RELEASE_ACCEPTANCE_MODE_IDS.CI &&
    ciReadout?.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED &&
    ciReadout?.complete === true &&
    ciReadout?.sourceRevision?.toLowerCase() === sourceRevision &&
    requiredComponents.length === REQUIRED_CI_COMPONENT_IDS.length &&
    requiredComponents.every(component =>
      component?.statusId === POLICY_RELEASE_ACCEPTANCE_STATUS_IDS.PASSED
    );

  if (!valid) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CI_ACCEPTANCE_INVALID);
  }

  return {
    generatedAt: ciReadout.generatedAt,
    requiredComponentIds: REQUIRED_CI_COMPONENT_IDS,
    version: ciReadout.version,
  };
}

function assertExpectedConsumerSmokeChecks(checks) {
  if (!isRecord(checks)) {
    return false;
  }

  const actualKeys = Object.keys(checks).sort();
  const expectedKeys = Object.keys(EXPECTED_CONSUMER_SMOKE_CHECKS).sort();
  return actualKeys.join(',') === expectedKeys.join(',') &&
    expectedKeys.every(key => checks[key] === EXPECTED_CONSUMER_SMOKE_CHECKS[key]);
}

function assertConsumerSmokeEvidence({ consumerSmokeEvidence, digest, sourceRevision }) {
  if (!isRecord(consumerSmokeEvidence)) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CONSUMER_SMOKE_INVALID);
  }

  let parsedImage;
  try {
    parsedImage = parsePublishedImageReference(consumerSmokeEvidence.image);
  } catch (_error) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CONSUMER_SMOKE_INVALID);
  }

  const valid = consumerSmokeEvidence.schema_version ===
      PUBLISHED_DIGEST_CONSUMER_SMOKE_SCHEMA_VERSION &&
    consumerSmokeEvidence.source_repository === EXPECTED_RELEASE_REPOSITORY &&
    consumerSmokeEvidence.signer_workflow === EXPECTED_SIGNER_WORKFLOW &&
    consumerSmokeEvidence.source_revision === sourceRevision &&
    parsedImage.digest === digest &&
    isIsoTimestamp(consumerSmokeEvidence.completed_at) &&
    assertExpectedConsumerSmokeChecks(consumerSmokeEvidence.checks);

  if (!valid) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.CONSUMER_SMOKE_INVALID);
  }

  return {
    checks: EXPECTED_CONSUMER_SMOKE_CHECKS,
    completedAt: consumerSmokeEvidence.completed_at,
    image: parsedImage.image,
  };
}

function assertProviderFaultReceipt({ providerFaultReceipt, sourceRevision }) {
  let receipt;
  try {
    receipt = validateAiProviderFaultComposeReceipt(providerFaultReceipt);
  } catch (_error) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.PROVIDER_FAULT_RECEIPT_INVALID);
  }

  if (
    receipt.source_revision !== sourceRevision ||
    receipt.outcome !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED ||
    receipt.status_id !== AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID
  ) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.PROVIDER_FAULT_RECEIPT_INVALID);
  }

  const receiptFingerprint = createAiProviderFaultComposeReceiptFingerprint(receipt);
  return {
    completedAt: receipt.completed_at,
    outcome: receipt.outcome,
    receiptFingerprint,
    schemaVersion: receipt.schema_version,
    sourceRevision: receipt.source_revision,
    statusId: receipt.status_id,
    testContract: receipt.test_contract,
  };
}

function createFingerprint(payload) {
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function createImages(digest) {
  return Object.fromEntries(PUBLISHED_IMAGE_REPOSITORIES.map(repository => [
    repository === 'ghcr.io/cloudbyday90/classifarr' ? 'ghcr' : 'dockerHub',
    `${repository}@${digest}`,
  ]));
}

/**
 * Creates the bounded evidence that becomes a release asset. Input artifacts
 * are validated but not embedded wholesale, keeping CI and smoke artifacts
 * independently verifiable and the public release asset configuration-free.
 */
export function buildReleaseCandidateEvidence({
  ciReadout,
  consumerSmokeEvidence,
  digest,
  generatedAt = new Date().toISOString(),
  providerFaultReceipt,
  sourceRevision,
  tag,
} = {}) {
  const verifiedTag = assertReleaseTag(tag);
  const verifiedSourceRevision = assertSourceRevision(sourceRevision);
  const verifiedDigest = assertDigest(digest);
  if (!isIsoTimestamp(generatedAt)) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.INVALID_INPUT);
  }

  const ciAcceptance = assertCiReadout({
    ciReadout,
    sourceRevision: verifiedSourceRevision,
  });
  const consumerSmoke = assertConsumerSmokeEvidence({
    consumerSmokeEvidence,
    digest: verifiedDigest,
    sourceRevision: verifiedSourceRevision,
  });
  const providerFaultReceiptSummary = assertProviderFaultReceipt({
    providerFaultReceipt,
    sourceRevision: verifiedSourceRevision,
  });
  const evidence = {
    ci_acceptance: ciAcceptance,
    consumer_smoke: consumerSmoke,
    generated_at: generatedAt,
    images: createImages(verifiedDigest),
    provider_fault_receipt: providerFaultReceiptSummary,
    schema_version: RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION,
    source_repository: EXPECTED_RELEASE_REPOSITORY,
    source_revision: verifiedSourceRevision,
    tag: verifiedTag,
  };

  return {
    ...evidence,
    evidence_fingerprint: {
      algorithm: 'sha256',
      value: createFingerprint(evidence),
    },
  };
}

function isCurrentEvidenceSchema(schemaVersion) {
  return schemaVersion === RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION;
}

function isLegacyEvidenceSchema(schemaVersion) {
  return schemaVersion === LEGACY_RELEASE_CANDIDATE_EVIDENCE_SCHEMA_VERSION;
}

function createEvidenceFingerprintPayload(evidence) {
  const payload = {
    ci_acceptance: evidence?.ci_acceptance,
    consumer_smoke: evidence?.consumer_smoke,
    generated_at: evidence?.generated_at,
    images: evidence?.images,
  };
  if (isCurrentEvidenceSchema(evidence?.schema_version)) {
    payload.provider_fault_receipt = evidence?.provider_fault_receipt;
  }
  return {
    ...payload,
    schema_version: evidence?.schema_version,
    source_repository: evidence?.source_repository,
    source_revision: evidence?.source_revision,
    tag: evidence?.tag,
  };
}

function isValidProviderFaultReceiptSummary(summary, sourceRevision) {
  return hasExactKeys(summary, PROVIDER_FAULT_RECEIPT_SUMMARY_KEYS) &&
    isIsoTimestamp(summary.completedAt) &&
    summary.outcome === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_OUTCOMES.PASSED &&
    summary.schemaVersion === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_SCHEMA_VERSION &&
    summary.sourceRevision === sourceRevision &&
    summary.statusId === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_PASSED_STATUS_ID &&
    summary.testContract === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_TEST_CONTRACT &&
    hasExactKeys(summary.receiptFingerprint, FINGERPRINT_KEYS) &&
    summary.receiptFingerprint.algorithm === AI_PROVIDER_FAULT_COMPOSE_RECEIPT_FINGERPRINT_ALGORITHM &&
    FINGERPRINT_PATTERN.test(summary.receiptFingerprint.value);
}

export function validateReleaseCandidateEvidence(evidence) {
  const issues = [];
  const isCurrentSchema = isCurrentEvidenceSchema(evidence?.schema_version);
  const isLegacySchema = isLegacyEvidenceSchema(evidence?.schema_version);
  if (!isCurrentSchema && !isLegacySchema) {
    issues.push('unknown_release_candidate_evidence_schema');
  } else if (!hasExactKeys(evidence, isCurrentSchema ? CURRENT_EVIDENCE_KEYS : LEGACY_EVIDENCE_KEYS)) {
    issues.push('unexpected_release_candidate_evidence_fields');
  }

  let tag;
  let sourceRevision;
  let digest;
  try {
    tag = assertReleaseTag(evidence?.tag);
    sourceRevision = assertSourceRevision(evidence?.source_revision);
    if (!hasExactKeys(evidence?.images, IMAGE_KEYS)) {
      throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.EVIDENCE_INVALID);
    }
    const ghcrImage = parsePublishedImageReference(evidence.images.ghcr);
    const dockerHubImage = parsePublishedImageReference(evidence.images.dockerHub);
    if (ghcrImage.repository !== 'ghcr.io/cloudbyday90/classifarr' ||
      dockerHubImage.repository !== 'docker.io/cloudbyday90/classifarr' ||
      ghcrImage.digest !== dockerHubImage.digest) {
      throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.EVIDENCE_INVALID);
    }
    digest = ghcrImage.digest;
  } catch (_error) {
    issues.push('invalid_release_identity');
  }

  if (evidence?.source_repository !== EXPECTED_RELEASE_REPOSITORY) {
    issues.push('unexpected_source_repository');
  }
  if (!isIsoTimestamp(evidence?.generated_at)) {
    issues.push('invalid_generated_at');
  }
  if (!hasExactKeys(evidence?.ci_acceptance, CI_ACCEPTANCE_KEYS) ||
    evidence.ci_acceptance.version === undefined ||
    !isIsoTimestamp(evidence.ci_acceptance.generatedAt) ||
    JSON.stringify(evidence.ci_acceptance.requiredComponentIds) !==
      JSON.stringify(REQUIRED_CI_COMPONENT_IDS)) {
    issues.push('invalid_ci_acceptance_summary');
  }
  if (!hasExactKeys(evidence?.consumer_smoke, CONSUMER_SMOKE_KEYS) ||
    !isIsoTimestamp(evidence.consumer_smoke.completedAt) ||
    !assertExpectedConsumerSmokeChecks(evidence.consumer_smoke.checks)) {
    issues.push('invalid_consumer_smoke_summary');
  } else {
    try {
      const smokeImage = parsePublishedImageReference(evidence.consumer_smoke.image);
      if (smokeImage.digest !== digest) {
        issues.push('consumer_smoke_digest_mismatch');
      }
    } catch (_error) {
      issues.push('invalid_consumer_smoke_image');
    }
  }
  if (isCurrentSchema) {
    if (!hasExactKeys(evidence?.provider_fault_receipt, PROVIDER_FAULT_RECEIPT_SUMMARY_KEYS)) {
      issues.push('unexpected_provider_fault_receipt_summary_fields');
    } else if (!isValidProviderFaultReceiptSummary(
      evidence.provider_fault_receipt,
      sourceRevision
    )) {
      issues.push('invalid_provider_fault_receipt_summary');
    }
  }

  const fingerprintPayload = createEvidenceFingerprintPayload(evidence);
  if (!hasExactKeys(evidence?.evidence_fingerprint, FINGERPRINT_KEYS) ||
    evidence.evidence_fingerprint.algorithm !== 'sha256' ||
    evidence.evidence_fingerprint.value !== createFingerprint(fingerprintPayload)) {
    issues.push('invalid_evidence_fingerprint');
  }

  return {
    evidence: issues.length === 0 ? { digest, sourceRevision, tag } : null,
    issueCount: issues.length,
    issues,
    ok: issues.length === 0,
  };
}

export function buildReleaseCandidateNotes(evidence) {
  const validation = validateReleaseCandidateEvidence(evidence);
  if (!validation.ok) {
    throwStatus(RELEASE_CANDIDATE_EVIDENCE_STATUS_IDS.EVIDENCE_INVALID);
  }

  const isCurrentSchema = isCurrentEvidenceSchema(evidence.schema_version);

  return [
    `# Classifarr ${evidence.tag}`,
    '',
    '## Release evidence',
    '',
    `- Source revision: \`${evidence.source_revision}\``,
    `- Evidence fingerprint: \`${evidence.evidence_fingerprint.value}\``,
    `- GHCR image: \`${evidence.images.ghcr}\``,
    `- Docker Hub image: \`${evidence.images.dockerHub}\``,
    `- Consumer smoke image: \`${evidence.consumer_smoke.image}\``,
    `- Consumer smoke completed: \`${evidence.consumer_smoke.completedAt}\``,
    ...(isCurrentSchema ? [
      `- Provider-fault receipt: \`${evidence.provider_fault_receipt.receiptFingerprint.value}\``,
      `- Provider-fault receipt completed: \`${evidence.provider_fault_receipt.completedAt}\``,
    ] : []),
    '',
    ...(isCurrentSchema ? [
      'The attached release-candidate evidence asset binds this tag to the exact',
      'CI-accepted source revision, passed provider-fault receipt, and digest-only',
      'consumer smoke result.',
    ] : [
      'The attached release-candidate evidence asset binds this tag to the exact',
      'CI-accepted source revision and digest-only consumer smoke result.',
    ]),
  ].join('\n');
}
