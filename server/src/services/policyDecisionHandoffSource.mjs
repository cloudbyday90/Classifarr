const POLICY_DECISION_HANDOFF_SOURCE_VERSION = 'policy.decision_handoff_source.v1';

const POLICY_DECISION_HANDOFF_SOURCE_IDS = Object.freeze({
  REQUEST_TIME_LEARNING: 'request_time_learning',
  LIBRARY_REBUILD: 'library_rebuild',
});

const POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS = Object.freeze({
  MISSING_SOURCE: 'missing_source',
  INVALID_SOURCE_VERSION: 'invalid_source_version',
  UNSUPPORTED_SOURCE: 'unsupported_source',
  DECISION_VERSION_MISMATCH: 'decision_version_mismatch',
  MISSING_ADMISSION: 'missing_admission',
  ADMISSION_NOT_APPROVED: 'admission_not_approved',
  MISSING_SOURCE_SUMMARY: 'missing_source_summary',
  SOURCE_SUMMARY_NOT_ADMITTED: 'source_summary_not_admitted',
  SOURCE_SUMMARY_MISMATCH: 'source_summary_mismatch',
  DECISION_WRITE_PERFORMED: 'decision_write_performed',
  REBUILD_PROFILE_REFRESH_QUEUED: 'rebuild_profile_refresh_queued',
  REBUILD_SIDE_EFFECT_STATE_INVALID: 'rebuild_side_effect_state_invalid',
});

const REQUIRED_LIBRARY_REBUILD_SIDE_EFFECT_IDS = Object.freeze([
  'learningWritten',
  'routingWritten',
  'policyStorageMutated',
]);

const SOURCE_CONTRACTS = Object.freeze([
  Object.freeze({
    sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.REQUEST_TIME_LEARNING,
    decisionVersion: 'policy.learning_guard.v1',
  }),
  Object.freeze({
    sourceId: POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD,
    decisionVersion: 'policy.library_rebuild_readiness_summary.v1',
  }),
]);

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getPolicyDecisionHandoffSource(sourceId) {
  const normalizedSourceId = normalizeString(sourceId);

  return SOURCE_CONTRACTS.find(source => source.sourceId === normalizedSourceId) || null;
}

function listPolicyDecisionHandoffSources() {
  return SOURCE_CONTRACTS;
}

function buildPolicyDecisionHandoffSource(sourceId) {
  const source = getPolicyDecisionHandoffSource(sourceId);

  if (!source) {
    throw new TypeError('Policy decision handoff source must be allowlisted.');
  }

  return {
    version: POLICY_DECISION_HANDOFF_SOURCE_VERSION,
    sourceId: source.sourceId,
    decisionVersion: source.decisionVersion,
  };
}

function buildIssue(riskId, message) {
  return { riskId, message };
}

function validatePolicyDecisionHandoffSourceSummary(
  decisionSourceSummary = {}
) {
  const summary = asObject(decisionSourceSummary);
  const sourceContract = getPolicyDecisionHandoffSource(summary.sourceId);
  const issues = [];

  if (!summary.sourceId) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.MISSING_SOURCE_SUMMARY,
      'Bounded workflow provenance requires a decision-source summary.'
    ));
  } else if (!sourceContract || summary.sourceId !== sourceContract.sourceId) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.UNSUPPORTED_SOURCE,
      'Decision-source summaries must use an approved canonical source ID.'
    ));
  }

  if (summary.admitted !== true) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.SOURCE_SUMMARY_NOT_ADMITTED,
      'Decision-source summaries must retain an approved admission result.'
    ));
  }

  if (
    sourceContract &&
    summary.decisionVersion !== sourceContract.decisionVersion
  ) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.DECISION_VERSION_MISMATCH,
      'Decision-source summaries must retain the expected decision contract version.'
    ));
  }

  return {
    version: `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.summary_audit`,
    ok: issues.length === 0,
    sourceId: sourceContract?.sourceId || null,
    decisionVersion: sourceContract?.decisionVersion || null,
    issueCount: issues.length,
    issues,
  };
}

function validatePolicyDecisionHandoffAdmission({
  decisionSourceAdmission,
  readinessBoundaryDecisionSource,
  embeddedReadinessDecisionSource,
} = {}) {
  const admission = asObject(decisionSourceAdmission);
  const sourceContract = getPolicyDecisionHandoffSource(admission.sourceId);
  const readinessBoundaryAudit = validatePolicyDecisionHandoffSourceSummary(
    readinessBoundaryDecisionSource
  );
  const embeddedReadinessAudit = validatePolicyDecisionHandoffSourceSummary(
    embeddedReadinessDecisionSource
  );
  const issues = [];

  if (!Object.keys(admission).length) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.MISSING_ADMISSION,
      'Bounded workflow provenance requires the readiness source-admission result.'
    ));
  } else if (
    admission.version !== `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.audit` ||
    admission.ok !== true ||
    admission.issueCount !== 0 ||
    asArray(admission.issues).length !== 0 ||
    !sourceContract ||
    admission.sourceId !== sourceContract.sourceId ||
    admission.decisionVersion !== sourceContract.decisionVersion
  ) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.ADMISSION_NOT_APPROVED,
      'Bounded workflow provenance requires a passing approved readiness source admission.'
    ));
  }

  [readinessBoundaryAudit, embeddedReadinessAudit]
    .forEach(audit => issues.push(...audit.issues));

  const sourceAudits = [readinessBoundaryAudit, embeddedReadinessAudit];
  if (
    sourceContract &&
    sourceAudits.every(audit => audit.ok) &&
    sourceAudits.some(audit =>
      audit.sourceId !== sourceContract.sourceId ||
      audit.decisionVersion !== sourceContract.decisionVersion
    )
  ) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.SOURCE_SUMMARY_MISMATCH,
      'Bounded workflow provenance requires matching readiness source summaries.'
    ));
  }

  return {
    version: `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.admission_audit`,
    ok: issues.length === 0,
    sourceId: issues.length === 0 ? sourceContract?.sourceId || null : null,
    decisionVersion: issues.length === 0 ? sourceContract?.decisionVersion || null : null,
    issueCount: issues.length,
    issues,
  };
}

function validatePolicyDecisionHandoffSource({
  boundedDecisionResult,
} = {}) {
  const result = asObject(boundedDecisionResult);
  const source = asObject(result.decisionSource);
  const decision = asObject(result.decision);
  const learning = asObject(decision.learning);
  const profileRefresh = asObject(decision.profileRefresh);
  const sideEffects = asObject(result.sideEffects);
  const issues = [];
  const sourceContract = getPolicyDecisionHandoffSource(source.sourceId);

  if (!source.sourceId) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.MISSING_SOURCE,
      'Bounded readiness requires an explicit decision-handoff source.'
    ));
  } else if (!sourceContract || source.sourceId !== sourceContract.sourceId) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.UNSUPPORTED_SOURCE,
      'Bounded readiness accepts only approved decision-handoff sources.'
    ));
  }

  if (source.version !== POLICY_DECISION_HANDOFF_SOURCE_VERSION) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.INVALID_SOURCE_VERSION,
      'Decision-handoff source must use the current source contract version.'
    ));
  }

  if (
    sourceContract &&
    (
      source.decisionVersion !== sourceContract.decisionVersion ||
      decision.version !== sourceContract.decisionVersion
    )
  ) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.DECISION_VERSION_MISMATCH,
      'Decision-handoff source and bounded decision must use the expected contract version.'
    ));
  }

  if (learning.writesPerformed !== false) {
    issues.push(buildIssue(
      POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.DECISION_WRITE_PERFORMED,
      'Bounded readiness cannot consume a decision that performed a learning write.'
    ));
  }

  if (sourceContract?.sourceId === POLICY_DECISION_HANDOFF_SOURCE_IDS.LIBRARY_REBUILD) {
    if (profileRefresh.queue !== false) {
      issues.push(buildIssue(
        POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.REBUILD_PROFILE_REFRESH_QUEUED,
        'Library rebuild readiness handoffs cannot queue profile refresh work.'
      ));
    }

    REQUIRED_LIBRARY_REBUILD_SIDE_EFFECT_IDS.forEach(sideEffectId => {
      if (sideEffects[sideEffectId] !== false) {
        issues.push(buildIssue(
          POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS.REBUILD_SIDE_EFFECT_STATE_INVALID,
          'Library rebuild readiness handoffs must explicitly disable all side effects.'
        ));
      }
    });
  }

  return {
    version: `${POLICY_DECISION_HANDOFF_SOURCE_VERSION}.audit`,
    ok: issues.length === 0,
    sourceId: sourceContract?.sourceId || null,
    decisionVersion: sourceContract?.decisionVersion || null,
    issueCount: issues.length,
    issues,
  };
}

export {
  POLICY_DECISION_HANDOFF_SOURCE_IDS,
  POLICY_DECISION_HANDOFF_SOURCE_RISK_IDS,
  POLICY_DECISION_HANDOFF_SOURCE_VERSION,
  buildPolicyDecisionHandoffSource,
  getPolicyDecisionHandoffSource,
  listPolicyDecisionHandoffSources,
  validatePolicyDecisionHandoffAdmission,
  validatePolicyDecisionHandoffSource,
  validatePolicyDecisionHandoffSourceSummary,
};
