import {
  buildBoundedPolicyEvidenceProjection,
  buildPolicyEvidenceBoundaryAudit,
} from './policyEvidenceBoundary.mjs';
import {
  buildPolicyLibraryProfileEvidenceLoaderAudit,
} from './policyLibraryProfileEvidenceLoader.mjs';

const POLICY_EVIDENCE_ENVELOPE_VERSION = 'policy.evidence.envelope.v1';
const MAX_EVIDENCE_RECORDS_PER_SECTION = 50;

const POLICY_EVIDENCE_ENVELOPE_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_PROFILE: 'blocked_by_profile',
  BLOCKED_BY_EVIDENCE_BOUNDARY: 'blocked_by_evidence_boundary',
});

const POLICY_EVIDENCE_ENVELOPE_SECTION_IDS = Object.freeze({
  CLASSIFICATION_OUTCOMES: 'classificationOutcomes',
  MANUAL_CORRECTIONS: 'manualCorrections',
  PENDING_ITEM_ANSWERS: 'pendingItemAnswers',
  ARR_ROUTING_OUTCOMES: 'arrRoutingOutcomes',
  METADATA_EVIDENCE: 'metadataEvidence',
});

const POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS = Object.freeze({
  READY_WITHOUT_PROFILE_HANDOFF: 'ready_without_profile_handoff',
  READY_WITHOUT_PROFILE_AUDIT: 'ready_without_profile_audit',
  READY_WITHOUT_EVIDENCE_BOUNDARY: 'ready_without_evidence_boundary',
  READY_WITHOUT_BOUNDARY_AUDIT: 'ready_without_boundary_audit',
  BLOCKED_WITH_NEXT_STEP: 'blocked_with_next_step',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
  SUMMARY_COUNT_MISMATCH: 'summary_count_mismatch',
});

const EVIDENCE_SECTION_IDS = Object.freeze(Object.values(POLICY_EVIDENCE_ENVELOPE_SECTION_IDS));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildSectionSnapshot(value) {
  const records = asArray(value);

  return {
    records: records.slice(0, MAX_EVIDENCE_RECORDS_PER_SECTION),
    receivedCount: records.length,
    acceptedCount: Math.min(records.length, MAX_EVIDENCE_RECORDS_PER_SECTION),
    truncated: records.length > MAX_EVIDENCE_RECORDS_PER_SECTION,
  };
}

function buildEvidenceSourceSummary(sectionSnapshots = {}) {
  return Object.fromEntries(EVIDENCE_SECTION_IDS.map(sectionId => {
    const snapshot = asPlainObject(sectionSnapshots[sectionId]);

    return [sectionId, {
      receivedCount: Number(snapshot.receivedCount) || 0,
      acceptedCount: Number(snapshot.acceptedCount) || 0,
      truncated: snapshot.truncated === true,
    }];
  }));
}

function buildSideEffects({ evidenceProjectionBuilt = false } = {}) {
  return {
    libraryProfileRead: false,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    evidenceProjectionBuilt,
    policyStorageMutated: false,
  };
}

function buildEnvelopeResult({
  statusId,
  ok,
  profileHandoff = null,
  profileAudit = null,
  evidenceBoundary = null,
  evidenceBoundaryAudit = null,
  sourceSummary = {},
  issues = [],
} = {}) {
  return {
    version: POLICY_EVIDENCE_ENVELOPE_VERSION,
    ok,
    statusId,
    issueCount: issues.length,
    issues,
    profileHandoff: profileHandoff
      ? {
        libraryId: profileHandoff.libraryId ?? null,
        statusId: profileHandoff.statusId ?? null,
        profileFreshness: profileHandoff.profileFreshness ?? null,
      }
      : null,
    profileAudit,
    sourceSummary,
    evidenceBoundary,
    evidenceBoundaryAudit,
    sideEffects: buildSideEffects({
      evidenceProjectionBuilt: evidenceBoundary?.sideEffects?.evidenceProjectionBuilt === true,
    }),
    nextStep: ok
      ? evidenceBoundary.nextStep
      : null,
  };
}

function buildPolicyEvidenceEnvelope({
  profileHandoff = null,
  operatorIntent = {},
  classificationOutcomes = [],
  manualCorrections = [],
  pendingItemAnswers = [],
  arrRoutingOutcomes = [],
  metadataEvidence = [],
} = {}) {
  const profileAudit = buildPolicyLibraryProfileEvidenceLoaderAudit(profileHandoff);
  const sectionSnapshots = {
    [POLICY_EVIDENCE_ENVELOPE_SECTION_IDS.CLASSIFICATION_OUTCOMES]: buildSectionSnapshot(classificationOutcomes),
    [POLICY_EVIDENCE_ENVELOPE_SECTION_IDS.MANUAL_CORRECTIONS]: buildSectionSnapshot(manualCorrections),
    [POLICY_EVIDENCE_ENVELOPE_SECTION_IDS.PENDING_ITEM_ANSWERS]: buildSectionSnapshot(pendingItemAnswers),
    [POLICY_EVIDENCE_ENVELOPE_SECTION_IDS.ARR_ROUTING_OUTCOMES]: buildSectionSnapshot(arrRoutingOutcomes),
    [POLICY_EVIDENCE_ENVELOPE_SECTION_IDS.METADATA_EVIDENCE]: buildSectionSnapshot(metadataEvidence),
  };
  const sourceSummary = buildEvidenceSourceSummary(sectionSnapshots);

  if (profileHandoff?.ok !== true || !profileAudit.ok) {
    return buildEnvelopeResult({
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_PROFILE,
      ok: false,
      profileHandoff,
      profileAudit,
      sourceSummary,
      issues: [{
        riskId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_PROFILE,
        message: 'Policy evidence envelope requires a successful cached-profile handoff.',
      }],
    });
  }

  const evidenceBoundary = buildBoundedPolicyEvidenceProjection({
    evidenceInput: {
      libraryProfile: profileHandoff.profileEvidence?.libraryProfile,
      operatorIntent,
      profileFreshness: profileHandoff.profileFreshness,
      classificationOutcomes: sectionSnapshots.classificationOutcomes.records,
      manualCorrections: sectionSnapshots.manualCorrections.records,
      pendingItemAnswers: sectionSnapshots.pendingItemAnswers.records,
      arrRoutingOutcomes: sectionSnapshots.arrRoutingOutcomes.records,
      metadataEvidence: sectionSnapshots.metadataEvidence.records,
    },
  });
  const evidenceBoundaryAudit = buildPolicyEvidenceBoundaryAudit(evidenceBoundary);

  if (!evidenceBoundary.ok || !evidenceBoundaryAudit.ok) {
    return buildEnvelopeResult({
      statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
      ok: false,
      profileHandoff,
      profileAudit,
      sourceSummary,
      evidenceBoundary,
      evidenceBoundaryAudit,
      issues: [{
        riskId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.BLOCKED_BY_EVIDENCE_BOUNDARY,
        message: 'Policy evidence envelope did not pass the evidence boundary.',
      }],
    });
  }

  return buildEnvelopeResult({
    statusId: POLICY_EVIDENCE_ENVELOPE_STATUS_IDS.READY,
    ok: true,
    profileHandoff,
    profileAudit,
    sourceSummary,
    evidenceBoundary,
    evidenceBoundaryAudit,
  });
}

function buildPolicyEvidenceEnvelopeAudit(result = {}) {
  const issues = [];
  const sourceSummary = asPlainObject(result.sourceSummary);
  const ready = result.ok === true;

  if (ready && result.profileHandoff?.libraryId === null) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.READY_WITHOUT_PROFILE_HANDOFF,
      message: 'Ready policy evidence envelope requires a cached-profile handoff.',
    });
  }

  if (ready && result.profileAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.READY_WITHOUT_PROFILE_AUDIT,
      message: 'Ready policy evidence envelope requires a successful profile audit.',
    });
  }

  if (ready && result.evidenceBoundary?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.READY_WITHOUT_EVIDENCE_BOUNDARY,
      message: 'Ready policy evidence envelope requires a successful evidence boundary.',
    });
  }

  if (ready && result.evidenceBoundaryAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.READY_WITHOUT_BOUNDARY_AUDIT,
      message: 'Ready policy evidence envelope requires a successful boundary audit.',
    });
  }

  if (!ready && result.nextStep !== null) {
    issues.push({
      riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      message: 'Blocked policy evidence envelope cannot advance to a downstream engine.',
    });
  }

  EVIDENCE_SECTION_IDS.forEach(sectionId => {
    const summary = asPlainObject(sourceSummary[sectionId]);
    const receivedCount = Number(summary.receivedCount) || 0;
    const acceptedCount = Number(summary.acceptedCount) || 0;
    const expectedAcceptedCount = Math.min(receivedCount, MAX_EVIDENCE_RECORDS_PER_SECTION);

    if (acceptedCount !== expectedAcceptedCount || summary.truncated !== (receivedCount > MAX_EVIDENCE_RECORDS_PER_SECTION)) {
      issues.push({
        riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.SUMMARY_COUNT_MISMATCH,
        message: 'Evidence source summaries must match bounded section counts.',
        sectionId,
      });
    }
  });

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && sideEffectId !== 'evidenceProjectionBuilt') {
      issues.push({
        riskId: POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Policy evidence envelope must not perform reads outside its cached profile handoff, live lookups, quota reads, or storage writes.',
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

export {
  MAX_EVIDENCE_RECORDS_PER_SECTION,
  POLICY_EVIDENCE_ENVELOPE_AUDIT_RISK_IDS,
  POLICY_EVIDENCE_ENVELOPE_SECTION_IDS,
  POLICY_EVIDENCE_ENVELOPE_STATUS_IDS,
  POLICY_EVIDENCE_ENVELOPE_VERSION,
  buildPolicyEvidenceEnvelope,
  buildPolicyEvidenceEnvelopeAudit,
};
