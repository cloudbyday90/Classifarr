import {
  buildPolicyEvidenceHandoffAudit,
} from './policyEvidenceHandoffVerifier.mjs';
import {
  buildPolicyIntentDraftFromBoundedEvidence,
  POLICY_INTENT_BOUNDARY_STATUS_IDS,
} from './policyIntentEngine.mjs';
import {
  policyLibraryEvidenceLoader,
} from './policyLibraryEvidenceLoader.mjs';

const POLICY_LIBRARY_INTENT_PROPOSAL_VERSION = 'policy.library_intent_proposal.v1';

const POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_EVIDENCE_HANDOFF: 'blocked_by_evidence_handoff',
  BLOCKED_BY_EVIDENCE_QUALITY: 'blocked_by_evidence_quality',
  BLOCKED_BY_INTENT_AUDIT: 'blocked_by_intent_audit',
  PROPOSAL_FAILED: 'proposal_failed',
});

const POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS = Object.freeze({
  EVIDENCE_HANDOFF_NOT_READY: 'evidence_handoff_not_ready',
  EVIDENCE_HANDOFF_INVALID: 'evidence_handoff_invalid',
  EVIDENCE_HANDOFF_FINGERPRINT_MISMATCH: 'evidence_handoff_fingerprint_mismatch',
  EVIDENCE_QUALITY_INSUFFICIENT: 'evidence_quality_insufficient',
  INTENT_AUDIT_FAILED: 'intent_audit_failed',
  PROPOSAL_FAILED: 'intent_proposal_failed',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
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

function buildProjectionFingerprintSummary(fingerprint = null) {
  const result = asPlainObject(fingerprint);

  return {
    version: result.version ?? null,
    algorithm: result.algorithm ?? null,
    fingerprint: result.fingerprint ?? null,
    provenance: asPlainObject(result.provenance),
    traceAttributes: asPlainObject(result.traceAttributes),
  };
}

function buildHandoffAuditSummary(audit = null) {
  return {
    ...buildAuditSummary(audit),
    projectionFingerprint: buildProjectionFingerprintSummary(
      asPlainObject(audit).projectionFingerprint
    ),
  };
}

function buildEvidenceProvenance(handoff = {}, handoffAudit = null) {
  const loader = asPlainObject(handoff);
  const envelope = asPlainObject(loader.evidenceEnvelope);
  const boundary = asPlainObject(envelope.evidenceBoundary);
  const projection = asPlainObject(boundary.projection);

  return {
    libraryId: loader.libraryId ?? null,
    loaderStatusId: loader.statusId ?? null,
    envelopeStatusId: envelope.statusId ?? null,
    boundaryStatusId: boundary.statusId ?? null,
    profileStatusId: loader.profileHandoff?.statusId ?? null,
    sourceSummary: asPlainObject(loader.sourceSummary),
    evidenceQuality: asPlainObject(projection.quality),
    projectionFingerprint: buildProjectionFingerprintSummary(
      asPlainObject(handoffAudit).projectionFingerprint
    ),
  };
}

function hasMatchingHandoffFingerprint(handoff = {}, handoffAudit = null) {
  const boundary = asPlainObject(asPlainObject(handoff).evidenceEnvelope)
    .evidenceBoundary;
  const boundaryFingerprint = asPlainObject(boundary).projectionFingerprint;
  const auditedFingerprint = asPlainObject(handoffAudit).projectionFingerprint;

  return typeof boundaryFingerprint?.fingerprint === 'string' &&
    boundaryFingerprint.fingerprint === auditedFingerprint.fingerprint;
}

function buildSideEffects({ handoff = null, intentDraftBuilt = false } = {}) {
  const inherited = asPlainObject(handoff?.sideEffects);

  return {
    libraryProfileRead: inherited.libraryProfileRead === true,
    sourceDatabaseRead: inherited.sourceDatabaseRead === true,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    intentDraftBuilt,
    policyStorageMutated: false,
  };
}

function buildProposalResult({
  statusId,
  ok,
  issue = null,
  handoff = null,
  handoffAudit = null,
  intentResult = null,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_INTENT_PROPOSAL_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    evidenceProvenance: buildEvidenceProvenance(handoff, handoffAudit),
    handoffAudit: buildHandoffAuditSummary(handoffAudit),
    intentAudit: buildAuditSummary(intentResult?.intentAudit),
    intent: ok ? intentResult?.intent ?? null : null,
    sideEffects: buildSideEffects({
      handoff,
      intentDraftBuilt: intentResult?.intent !== null && intentResult?.intent !== undefined,
    }),
    nextStep: ok ? intentResult?.nextStep ?? null : null,
  };
}

function resolveIntentIssue(intentResult = {}) {
  if (intentResult.statusId === POLICY_INTENT_BOUNDARY_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY) {
    return {
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_QUALITY,
      issue: {
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_QUALITY_INSUFFICIENT,
        message: 'Library evidence does not yet support an intent proposal.',
      },
    };
  }

  return {
    statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_INTENT_AUDIT,
    issue: {
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.INTENT_AUDIT_FAILED,
      message: 'Library evidence did not satisfy the intent proposal contract.',
    },
  };
}

function createPolicyLibraryIntentProposalService({
  libraryEvidenceLoader = policyLibraryEvidenceLoader,
  buildHandoffAudit = buildPolicyEvidenceHandoffAudit,
  buildIntent = buildPolicyIntentDraftFromBoundedEvidence,
} = {}) {
  async function proposeLibraryIntent(options = {}) {
    const loadLibraryEvidence = libraryEvidenceLoader?.loadLibraryEvidence;
    if (typeof loadLibraryEvidence !== 'function') {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
          message: 'Library intent proposal could not be prepared.',
        },
      });
    }

    let handoff;
    try {
      handoff = await loadLibraryEvidence.call(libraryEvidenceLoader, options);
    } catch {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
          message: 'Library intent proposal could not be prepared.',
        },
      });
    }

    let handoffAudit;
    try {
      handoffAudit = buildHandoffAudit(handoff);
    } catch {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
        ok: false,
        handoff,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
          message: 'Library intent proposal could not be prepared.',
        },
      });
    }
    if (!handoffAudit.ok) {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_HANDOFF,
        ok: false,
        handoff,
        handoffAudit,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_INVALID,
          message: 'Library evidence did not satisfy the verified handoff contract.',
        },
      });
    }

    if (handoffAudit.readyForIntent !== true) {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_HANDOFF,
        ok: false,
        handoff,
        handoffAudit,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_NOT_READY,
          message: 'Library evidence is not ready for an intent proposal.',
        },
      });
    }

    if (!hasMatchingHandoffFingerprint(handoff, handoffAudit)) {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.BLOCKED_BY_EVIDENCE_HANDOFF,
        ok: false,
        handoff,
        handoffAudit,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_FINGERPRINT_MISMATCH,
          message: 'Library evidence fingerprint did not satisfy the verified handoff contract.',
        },
      });
    }

    let intentResult;
    try {
      intentResult = buildIntent({
        boundedEvidenceResult: handoff?.evidenceEnvelope?.evidenceBoundary,
      });
    } catch {
      return buildProposalResult({
        statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.PROPOSAL_FAILED,
        ok: false,
        handoff,
        handoffAudit,
        issue: {
          riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
          message: 'Library intent proposal could not be prepared.',
        },
      });
    }

    if (intentResult?.ok !== true) {
      const resolution = resolveIntentIssue(intentResult);
      return buildProposalResult({
        statusId: resolution.statusId,
        ok: false,
        handoff,
        handoffAudit,
        intentResult,
        issue: resolution.issue,
      });
    }

    return buildProposalResult({
      statusId: POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.READY,
      ok: true,
      handoff,
      handoffAudit,
      intentResult,
    });
  }

  return {
    proposeLibraryIntent,
  };
}

function buildPolicyLibraryIntentProposalAudit(result = {}) {
  const proposal = asPlainObject(result);
  const issues = [];
  const ok = proposal.ok === true;
  const knownStatus = Object.values(POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS)
    .includes(proposal.statusId);

  if (!knownStatus) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
      message: 'Library intent proposal returned an unknown status.',
    });
  }

  if (proposal.issueCount !== (Array.isArray(proposal.issues) ? proposal.issues.length : 0)) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.PROPOSAL_FAILED,
      message: 'Library intent proposal issue count must match returned issues.',
    });
  }

  if (ok && proposal.statusId !== POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.INTENT_AUDIT_FAILED,
      message: 'Ready library intent proposal requires the ready status.',
    });
  }

  if (ok && proposal.intentAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.INTENT_AUDIT_FAILED,
      message: 'Ready library intent proposal requires a successful intent audit.',
    });
  }

  if (ok && proposal.handoffAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_INVALID,
      message: 'Ready library intent proposal requires a successful evidence handoff audit.',
    });
  }

  if (ok && !proposal.evidenceProvenance?.projectionFingerprint?.fingerprint) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_INVALID,
      message: 'Ready library intent proposal requires evidence fingerprint provenance.',
    });
  }

  if (
    ok &&
    proposal.evidenceProvenance?.projectionFingerprint?.fingerprint !==
      proposal.handoffAudit?.projectionFingerprint?.fingerprint
  ) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_FINGERPRINT_MISMATCH,
      message: 'Ready library intent proposal fingerprint must match verified handoff provenance.',
    });
  }

  if (!ok && proposal.nextStep !== null) {
    issues.push({
      riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.EVIDENCE_HANDOFF_NOT_READY,
      message: 'Blocked library intent proposals cannot advance to a downstream workflow.',
    });
  }

  Object.entries(asPlainObject(proposal.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && ![
      'libraryProfileRead',
      'sourceDatabaseRead',
      'intentDraftBuilt',
    ].includes(sideEffectId)) {
      issues.push({
        riskId: POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Library intent proposals must not perform live lookups, quota reads, or storage writes.',
        sideEffectId,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

const policyLibraryIntentProposalService = createPolicyLibraryIntentProposalService();

export {
  POLICY_LIBRARY_INTENT_PROPOSAL_RISK_IDS,
  POLICY_LIBRARY_INTENT_PROPOSAL_STATUS_IDS,
  POLICY_LIBRARY_INTENT_PROPOSAL_VERSION,
  buildPolicyLibraryIntentProposalAudit,
  createPolicyLibraryIntentProposalService,
  policyLibraryIntentProposalService,
};
