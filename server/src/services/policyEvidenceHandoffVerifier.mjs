import { AUTHORITY_SOURCE_IDS } from './policyAuthorityVocabulary.mjs';
import {
  buildPolicyEvidenceBoundaryAudit,
} from './policyEvidenceBoundary.mjs';
import {
  buildPolicyEvidenceEngineAudit,
  POLICY_EVIDENCE_BUCKET_IDS,
  isPolicyEvidenceQualityContribution,
} from './policyEvidenceEngine.mjs';
import {
  buildPolicyEvidenceEnvelopeAudit,
} from './policyEvidenceEnvelope.mjs';
import {
  validatePolicyEvidenceFingerprint,
} from './policyEvidenceFingerprint.mjs';
import {
  validatePolicyEvidenceQualityAssessment,
} from './policyEvidenceQuality.mjs';
import {
  buildPolicyLibraryEvidenceLoaderAudit,
  policyLibraryEvidenceLoader,
} from './policyLibraryEvidenceLoader.mjs';

const POLICY_EVIDENCE_HANDOFF_VERIFIER_VERSION = 'policy.evidence.handoff_verifier.v1';

const POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_LIBRARY_EVIDENCE: 'blocked_by_library_evidence',
  INVALID_HANDOFF: 'invalid_handoff',
  VERIFICATION_FAILED: 'verification_failed',
});

const POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS = Object.freeze({
  HANDOFF_NOT_READY: 'handoff_not_ready',
  LOADER_AUDIT_FAILED: 'loader_audit_failed',
  ENGINE_AUDIT_FAILED: 'engine_audit_failed',
  ENVELOPE_AUDIT_FAILED: 'envelope_audit_failed',
  BOUNDARY_AUDIT_FAILED: 'boundary_audit_failed',
  FINGERPRINT_AUDIT_FAILED: 'fingerprint_audit_failed',
  QUALITY_AUDIT_FAILED: 'quality_audit_failed',
  BLOCKED_WITH_NEXT_STEP: 'blocked_with_next_step',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  VERIFICATION_FAILED: 'verification_failed',
});

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildAuditSummary(audit = null) {
  const result = asPlainObject(audit);

  return {
    ok: result.ok === true,
    issueCount: Number(result.issueCount) || 0,
    riskIds: Array.isArray(result.issues)
      ? result.issues.map(issue => issue?.riskId).filter(Boolean).sort()
      : [],
  };
}

function buildHandoffSummary(handoff = {}) {
  const loader = asPlainObject(handoff);
  const envelope = asPlainObject(loader.evidenceEnvelope);
  const boundary = asPlainObject(envelope.evidenceBoundary);
  const fingerprint = asPlainObject(boundary.projectionFingerprint);
  const projection = asPlainObject(boundary.projection);

  return {
    libraryId: loader.libraryId ?? null,
    loaderStatusId: loader.statusId ?? null,
    envelopeStatusId: envelope.statusId ?? null,
    boundaryStatusId: boundary.statusId ?? null,
    profileStatusId: loader.profileHandoff?.statusId ?? null,
    sourceSummary: asPlainObject(loader.sourceSummary),
    evidenceQuality: asPlainObject(projection.quality),
    fingerprint: {
      version: fingerprint.version ?? null,
      algorithm: fingerprint.algorithm ?? null,
      provenance: asPlainObject(fingerprint.provenance),
      traceAttributes: asPlainObject(fingerprint.traceAttributes),
    },
    nextStep: loader.nextStep ?? null,
  };
}

function buildPolicyEvidenceHandoffAudit(handoff = {}, {
  buildLoaderAudit = buildPolicyLibraryEvidenceLoaderAudit,
  buildEngineAudit = buildPolicyEvidenceEngineAudit,
  buildEnvelopeAudit = buildPolicyEvidenceEnvelopeAudit,
  buildBoundaryAudit = buildPolicyEvidenceBoundaryAudit,
  validateFingerprint = validatePolicyEvidenceFingerprint,
  validateQuality = validatePolicyEvidenceQualityAssessment,
} = {}) {
  const issues = [];
  const loaderResult = asPlainObject(handoff);
  const envelope = asPlainObject(loaderResult.evidenceEnvelope);
  const boundary = asPlainObject(envelope.evidenceBoundary);
  const projection = asPlainObject(boundary.projection);
  const loaderAudit = buildLoaderAudit(loaderResult);
  const engineAudit = buildEngineAudit();
  const envelopeAudit = buildEnvelopeAudit(envelope);
  const boundaryAudit = buildBoundaryAudit(boundary);
  const fingerprintAudit = validateFingerprint({
    projection,
    projectionFingerprint: boundary.projectionFingerprint,
  });
  const qualityAudit = validateQuality(projection, {
    bucketIds: POLICY_EVIDENCE_BUCKET_IDS,
    authoritySourceIds: AUTHORITY_SOURCE_IDS,
    isTrustedEntry: isPolicyEvidenceQualityContribution,
  });
  const handoffReady = loaderResult.ok === true;

  if (!loaderAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.LOADER_AUDIT_FAILED,
      message: 'Library evidence handoff failed its loader audit.',
    });
  }

  if (!engineAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.ENGINE_AUDIT_FAILED,
      message: 'Policy evidence engine contract failed its static audit.',
    });
  }

  if (handoffReady && !envelopeAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.ENVELOPE_AUDIT_FAILED,
      message: 'Ready library evidence requires a successful envelope audit.',
    });
  }

  if (handoffReady && !boundaryAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.BOUNDARY_AUDIT_FAILED,
      message: 'Ready library evidence requires a successful boundary audit.',
    });
  }

  if (handoffReady && !fingerprintAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.FINGERPRINT_AUDIT_FAILED,
      message: 'Ready library evidence requires a valid projection fingerprint.',
    });
  }

  if (handoffReady && !qualityAudit.ok) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.QUALITY_AUDIT_FAILED,
      message: 'Ready library evidence requires a valid evidence quality assessment.',
    });
  }

  if (!handoffReady && loaderResult.nextStep !== null) {
    issues.push({
      riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      message: 'Blocked library evidence cannot advance to intent inference.',
    });
  }

  Object.entries(asPlainObject(loaderResult.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && ![
      'libraryProfileRead',
      'sourceDatabaseRead',
      'evidenceEnvelopeBuilt',
    ].includes(sideEffectId)) {
      issues.push({
        riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Evidence handoff verification cannot claim live lookup, quota, or storage-write side effects.',
        sideEffectId,
      });
    }
  });

  return {
    version: POLICY_EVIDENCE_HANDOFF_VERIFIER_VERSION,
    ok: issues.length === 0,
    readyForIntent: handoffReady && issues.length === 0,
    issueCount: issues.length,
    issues,
    loaderAudit: buildAuditSummary(loaderAudit),
    engineAudit: buildAuditSummary(engineAudit),
    envelopeAudit: buildAuditSummary(envelopeAudit),
    boundaryAudit: buildAuditSummary(boundaryAudit),
    fingerprintAudit: buildAuditSummary(fingerprintAudit),
    qualityAudit: buildAuditSummary(qualityAudit),
  };
}

function buildVerifierResult({
  statusId,
  ok,
  issue = null,
  audit = null,
  handoff = null,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_EVIDENCE_HANDOFF_VERIFIER_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    audit,
    handoff: buildHandoffSummary(handoff),
    nextStep: ok ? handoff?.nextStep ?? null : null,
  };
}

function createPolicyEvidenceHandoffVerifier({
  libraryEvidenceLoader = policyLibraryEvidenceLoader,
  buildHandoffAudit = buildPolicyEvidenceHandoffAudit,
} = {}) {
  async function verifyLibraryEvidenceHandoff(options = {}) {
    const loadLibraryEvidence = libraryEvidenceLoader?.loadLibraryEvidence;
    if (typeof loadLibraryEvidence !== 'function') {
      return buildVerifierResult({
        statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.VERIFICATION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.VERIFICATION_FAILED,
          message: 'Library evidence handoff could not be verified.',
        },
      });
    }

    let handoff;
    try {
      handoff = await loadLibraryEvidence.call(libraryEvidenceLoader, options);
    } catch {
      return buildVerifierResult({
        statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.VERIFICATION_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.VERIFICATION_FAILED,
          message: 'Library evidence handoff could not be verified.',
        },
      });
    }

    const audit = buildHandoffAudit(handoff);
    if (!audit.ok) {
      return buildVerifierResult({
        statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.INVALID_HANDOFF,
        ok: false,
        issue: {
          riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.VERIFICATION_FAILED,
          message: 'Library evidence handoff did not satisfy its verification contract.',
        },
        audit,
        handoff,
      });
    }

    if (audit.readyForIntent !== true) {
      return buildVerifierResult({
        statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.BLOCKED_BY_LIBRARY_EVIDENCE,
        ok: false,
        issue: {
          riskId: POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS.HANDOFF_NOT_READY,
          message: 'Library evidence is not ready for intent inference.',
        },
        audit,
        handoff,
      });
    }

    return buildVerifierResult({
      statusId: POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS.READY,
      ok: true,
      audit,
      handoff,
    });
  }

  return {
    verifyLibraryEvidenceHandoff,
  };
}

const policyEvidenceHandoffVerifier = createPolicyEvidenceHandoffVerifier();

export {
  POLICY_EVIDENCE_HANDOFF_VERIFIER_RISK_IDS,
  POLICY_EVIDENCE_HANDOFF_VERIFIER_STATUS_IDS,
  POLICY_EVIDENCE_HANDOFF_VERIFIER_VERSION,
  buildPolicyEvidenceHandoffAudit,
  createPolicyEvidenceHandoffVerifier,
  policyEvidenceHandoffVerifier,
};
