import {
  buildPolicyEvidenceEnvelope,
  buildPolicyEvidenceEnvelopeAudit,
} from './policyEvidenceEnvelope.mjs';
import {
  buildPolicyLibraryMetadataEvidenceCollectorAudit,
  policyLibraryMetadataEvidenceCollector,
} from './policyLibraryMetadataEvidenceCollector.mjs';
import {
  buildPolicyLibraryOutcomeEvidenceCollectorAudit,
  policyLibraryOutcomeEvidenceCollector,
} from './policyLibraryOutcomeEvidenceCollector.mjs';
import {
  buildPolicyLibraryPendingAnswerEvidenceCollectorAudit,
  policyLibraryPendingAnswerEvidenceCollector,
} from './policyLibraryPendingAnswerEvidenceCollector.mjs';
import {
  buildPolicyLibraryProfileEvidenceLoaderAudit,
  loadPolicyLibraryProfileEvidence,
} from './policyLibraryProfileEvidenceLoader.mjs';
import {
  buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit,
  policyLibraryRoutingOutcomeEvidenceCollector,
} from './policyLibraryRoutingOutcomeEvidenceCollector.mjs';

const POLICY_LIBRARY_EVIDENCE_LOADER_VERSION = 'policy.library_evidence_loader.v1';

const POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS = Object.freeze({
  READY: 'ready',
  INVALID_LIBRARY_ID: 'invalid_library_id',
  BLOCKED_BY_PROFILE: 'blocked_by_profile',
  BLOCKED_BY_SOURCE_COLLECTION: 'blocked_by_source_collection',
  BLOCKED_BY_ENVELOPE: 'blocked_by_envelope',
});

const POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS = Object.freeze({
  INVALID_LIBRARY_ID: 'invalid_library_id',
  PROFILE_NOT_READY: 'profile_not_ready',
  SOURCE_COLLECTION_FAILED: 'source_collection_failed',
  ENVELOPE_BLOCKED: 'envelope_blocked',
  READY_WITHOUT_PROFILE_AUDIT: 'ready_without_profile_audit',
  READY_WITHOUT_SOURCE_AUDIT: 'ready_without_source_audit',
  READY_WITHOUT_ENVELOPE_AUDIT: 'ready_without_envelope_audit',
  BLOCKED_WITH_NEXT_STEP: 'blocked_with_next_step',
  UNSAFE_SIDE_EFFECT: 'unsafe_side_effect',
});

const POLICY_LIBRARY_EVIDENCE_SOURCE_IDS = Object.freeze({
  OUTCOMES: 'outcomes',
  PENDING_ANSWERS: 'pending_answers',
  ROUTING_OUTCOMES: 'routing_outcomes',
  METADATA: 'metadata',
});

const SOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: POLICY_LIBRARY_EVIDENCE_SOURCE_IDS.OUTCOMES,
    collectMethod: 'collectLibraryOutcomeEvidence',
    audit: buildPolicyLibraryOutcomeEvidenceCollectorAudit,
  }),
  Object.freeze({
    id: POLICY_LIBRARY_EVIDENCE_SOURCE_IDS.PENDING_ANSWERS,
    collectMethod: 'collectLibraryPendingAnswerEvidence',
    audit: buildPolicyLibraryPendingAnswerEvidenceCollectorAudit,
  }),
  Object.freeze({
    id: POLICY_LIBRARY_EVIDENCE_SOURCE_IDS.ROUTING_OUTCOMES,
    collectMethod: 'collectLibraryRoutingOutcomeEvidence',
    audit: buildPolicyLibraryRoutingOutcomeEvidenceCollectorAudit,
  }),
  Object.freeze({
    id: POLICY_LIBRARY_EVIDENCE_SOURCE_IDS.METADATA,
    collectMethod: 'collectLibraryMetadataEvidence',
    audit: buildPolicyLibraryMetadataEvidenceCollectorAudit,
  }),
]);

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeLibraryId(value) {
  const libraryId = Number(value);
  return Number.isInteger(libraryId) && libraryId > 0 ? libraryId : null;
}

function buildSourceSummary({ result = null, audit = null } = {}) {
  const sourceResult = asPlainObject(result);

  return {
    ok: sourceResult.ok === true && audit?.ok === true,
    statusId: typeof sourceResult.statusId === 'string' ? sourceResult.statusId : null,
    issueCount: Number(sourceResult.issueCount) || 0,
    audit: audit
      ? {
        ok: audit.ok === true,
        issueCount: Number(audit.issueCount) || 0,
        riskIds: Array.isArray(audit.issues)
          ? audit.issues.map(issue => issue?.riskId).filter(Boolean).sort()
          : [],
      }
      : null,
    summary: asPlainObject(sourceResult.summary),
  };
}

function buildSideEffects({
  libraryProfileRead = false,
  sourceDatabaseRead = false,
  evidenceEnvelopeBuilt = false,
} = {}) {
  return {
    libraryProfileRead,
    sourceDatabaseRead,
    liveMediaServerLookupPerformed: false,
    liveProviderLookupPerformed: false,
    providerQuotaRead: false,
    evidenceEnvelopeBuilt,
    policyStorageMutated: false,
  };
}

function buildLoaderResult({
  libraryId = null,
  statusId,
  ok,
  issue = null,
  profileHandoff = null,
  profileAudit = null,
  sourceSummary = {},
  evidenceEnvelope = null,
  evidenceEnvelopeAudit = null,
  libraryProfileRead = false,
  sourceDatabaseRead = false,
} = {}) {
  const issues = issue ? [issue] : [];

  return {
    version: POLICY_LIBRARY_EVIDENCE_LOADER_VERSION,
    ok,
    statusId,
    libraryId,
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
    evidenceEnvelope,
    evidenceEnvelopeAudit,
    sideEffects: buildSideEffects({
      libraryProfileRead,
      sourceDatabaseRead,
      evidenceEnvelopeBuilt: evidenceEnvelope?.sideEffects?.evidenceProjectionBuilt === true,
    }),
    nextStep: ok ? evidenceEnvelope?.nextStep ?? null : null,
  };
}

async function collectSource({ definition, collector, libraryId }) {
  const collect = collector?.[definition.collectMethod];
  if (typeof collect !== 'function') {
    return {
      id: definition.id,
      result: null,
      audit: null,
    };
  }

  try {
    const result = await collect.call(collector, { libraryId });
    return {
      id: definition.id,
      result,
      audit: definition.audit(result),
    };
  } catch {
    return {
      id: definition.id,
      result: null,
      audit: null,
    };
  }
}

function buildSourceSummaryMap(sourceResults = []) {
  return Object.fromEntries(sourceResults.map(source => [
    source.id,
    buildSourceSummary(source),
  ]));
}

function sourceResultsAreReady(sourceResults = []) {
  return sourceResults.every(source => source.result?.ok === true && source.audit?.ok === true);
}

function sourceDatabaseRead(sourceResults = []) {
  return sourceResults.some(source => source.result?.sideEffects?.databaseRead === true);
}

function createPolicyLibraryEvidenceLoader({
  loadProfileEvidence = loadPolicyLibraryProfileEvidence,
  buildProfileEvidenceAudit = buildPolicyLibraryProfileEvidenceLoaderAudit,
  outcomeCollector = policyLibraryOutcomeEvidenceCollector,
  pendingAnswerCollector = policyLibraryPendingAnswerEvidenceCollector,
  routingOutcomeCollector = policyLibraryRoutingOutcomeEvidenceCollector,
  metadataCollector = policyLibraryMetadataEvidenceCollector,
  buildEnvelope = buildPolicyEvidenceEnvelope,
  buildEnvelopeAudit = buildPolicyEvidenceEnvelopeAudit,
} = {}) {
  async function loadLibraryEvidence({
    libraryId,
    operatorIntent = {},
    getProfile,
    now,
    maximumAgeMs,
  } = {}) {
    const normalizedLibraryId = normalizeLibraryId(libraryId);
    if (normalizedLibraryId === null) {
      return buildLoaderResult({
        statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.INVALID_LIBRARY_ID,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.INVALID_LIBRARY_ID,
          message: 'Library evidence requires a positive integer library ID.',
        },
      });
    }

    let profileHandoff;
    try {
      profileHandoff = await loadProfileEvidence({
        libraryId: normalizedLibraryId,
        getProfile,
        now,
        maximumAgeMs,
      });
    } catch {
      profileHandoff = null;
    }
    const profileAudit = buildProfileEvidenceAudit(profileHandoff);
    const libraryProfileRead = profileHandoff?.sideEffects?.libraryProfileRead === true;

    if (profileHandoff?.ok !== true || !profileAudit.ok) {
      return buildLoaderResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.BLOCKED_BY_PROFILE,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.PROFILE_NOT_READY,
          message: 'Library evidence requires a successful cached-profile handoff.',
        },
        profileHandoff,
        profileAudit,
        libraryProfileRead,
      });
    }

    const collectors = [
      outcomeCollector,
      pendingAnswerCollector,
      routingOutcomeCollector,
      metadataCollector,
    ];
    const sourceResults = await Promise.all(SOURCE_DEFINITIONS.map((definition, index) => collectSource({
      definition,
      collector: collectors[index],
      libraryId: normalizedLibraryId,
    })));
    const sourceSummary = buildSourceSummaryMap(sourceResults);
    const sourcesRead = sourceDatabaseRead(sourceResults);

    if (!sourceResultsAreReady(sourceResults)) {
      return buildLoaderResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.BLOCKED_BY_SOURCE_COLLECTION,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.SOURCE_COLLECTION_FAILED,
          message: 'Library evidence requires successful bounded source collection.',
        },
        profileHandoff,
        profileAudit,
        sourceSummary,
        libraryProfileRead,
        sourceDatabaseRead: sourcesRead,
      });
    }

    const [outcomes, pendingAnswers, routingOutcomes, metadata] = sourceResults.map(source => source.result);
    const evidenceEnvelope = buildEnvelope({
      profileHandoff,
      operatorIntent,
      classificationOutcomes: outcomes.classificationOutcomes,
      manualCorrections: outcomes.manualCorrections,
      pendingItemAnswers: pendingAnswers.pendingItemAnswers,
      arrRoutingOutcomes: routingOutcomes.arrRoutingOutcomes,
      metadataEvidence: metadata.metadataEvidence,
    });
    const evidenceEnvelopeAudit = buildEnvelopeAudit(evidenceEnvelope);

    if (evidenceEnvelope?.ok !== true || !evidenceEnvelopeAudit.ok) {
      return buildLoaderResult({
        libraryId: normalizedLibraryId,
        statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.BLOCKED_BY_ENVELOPE,
        ok: false,
        issue: {
          riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.ENVELOPE_BLOCKED,
          message: 'Library evidence did not pass the bounded evidence envelope.',
        },
        profileHandoff,
        profileAudit,
        sourceSummary,
        evidenceEnvelope,
        evidenceEnvelopeAudit,
        libraryProfileRead,
        sourceDatabaseRead: sourcesRead,
      });
    }

    return buildLoaderResult({
      libraryId: normalizedLibraryId,
      statusId: POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.READY,
      ok: true,
      profileHandoff,
      profileAudit,
      sourceSummary,
      evidenceEnvelope,
      evidenceEnvelopeAudit,
      libraryProfileRead,
      sourceDatabaseRead: sourcesRead,
    });
  }

  return {
    loadLibraryEvidence,
  };
}

function buildPolicyLibraryEvidenceLoaderAudit(result = {}) {
  const issues = [];
  const ready = result.ok === true;
  const sourceSummary = asPlainObject(result.sourceSummary);

  if (ready && result.statusId !== POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS.READY) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.ENVELOPE_BLOCKED,
      message: 'Ready library evidence must have a ready status.',
    });
  }

  if (ready && result.profileAudit?.ok !== true) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_PROFILE_AUDIT,
      message: 'Ready library evidence requires a successful profile audit.',
    });
  }

  Object.values(POLICY_LIBRARY_EVIDENCE_SOURCE_IDS).forEach(sourceId => {
    const source = asPlainObject(sourceSummary[sourceId]);
    if (ready && (source.ok !== true || source.audit?.ok !== true)) {
      issues.push({
        riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_SOURCE_AUDIT,
        message: 'Ready library evidence requires a successful audit for every source collector.',
        sourceId,
      });
    }
  });

  if (ready && (result.evidenceEnvelope?.ok !== true || result.evidenceEnvelopeAudit?.ok !== true)) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.READY_WITHOUT_ENVELOPE_AUDIT,
      message: 'Ready library evidence requires a successful bounded evidence envelope and audit.',
    });
  }

  if (!ready && result.nextStep !== null) {
    issues.push({
      riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.BLOCKED_WITH_NEXT_STEP,
      message: 'Blocked library evidence cannot advance to a downstream engine.',
    });
  }

  Object.entries(asPlainObject(result.sideEffects)).forEach(([sideEffectId, performed]) => {
    if (performed === true && ![
      'libraryProfileRead',
      'sourceDatabaseRead',
      'evidenceEnvelopeBuilt',
    ].includes(sideEffectId)) {
      issues.push({
        riskId: POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS.UNSAFE_SIDE_EFFECT,
        message: 'Library evidence loading must not perform live lookups, quota reads, or storage writes.',
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

const policyLibraryEvidenceLoader = createPolicyLibraryEvidenceLoader();

export {
  POLICY_LIBRARY_EVIDENCE_LOADER_RISK_IDS,
  POLICY_LIBRARY_EVIDENCE_LOADER_STATUS_IDS,
  POLICY_LIBRARY_EVIDENCE_LOADER_VERSION,
  POLICY_LIBRARY_EVIDENCE_SOURCE_IDS,
  buildPolicyLibraryEvidenceLoaderAudit,
  createPolicyLibraryEvidenceLoader,
  policyLibraryEvidenceLoader,
};
