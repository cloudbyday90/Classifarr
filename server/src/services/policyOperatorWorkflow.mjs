import {
  POLICY_EVIDENCE_QUALITY_STATUS_IDS,
} from './policyEvidenceQuality.mjs';
import {
  POLICY_INTENT_FIELD_IDS,
  buildPolicyIntentDraftFromEvidenceInput,
} from './policyIntentEngine.mjs';
import {
  POLICY_AUTOMATION_READINESS_STATE_IDS,
  buildPolicyAutomationReadinessFromContracts,
} from './policyAutomationReadinessEngine.mjs';
import {
  buildPolicyOperatorWorkflowEntryAudit,
  normalizePolicyOperatorWorkflowEntries,
} from './policyOperatorWorkflowEntryNormalizer.mjs';
import {
  POLICY_SETUP_FIELD_CONTROL_KIND_IDS,
  POLICY_UX_TERM_IDS,
  includesInternalPolicyLanguage,
} from './policyUserMentalModel.mjs';

const POLICY_OPERATOR_WORKFLOW_SECTION_IDS = Object.freeze({
  WHAT_BELONGS_HERE: 'what_belongs_here',
  WHAT_SHOULD_NOT_GO_HERE: 'what_should_not_go_here',
  WHAT_HELPS: 'what_helps_but_should_not_decide_alone',
  WHEN_TO_ASK: 'when_should_classifarr_ask',
  CAN_THIS_ROUTE: 'can_this_route',
});

const POLICY_OPERATOR_WORKFLOW_ACTION_IDS = Object.freeze({
  ACCEPT_EXAMPLES: 'accept_examples',
  EDIT_LIMITS: 'edit_limits',
  REVIEW_HELPERS: 'review_helpers',
  EDIT_REVIEW_TRIGGERS: 'edit_review_triggers',
  RESOLVE_READINESS: 'resolve_readiness',
});

const POLICY_OPERATOR_WORKFLOW_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  NEEDS_ACTION: 'needs_action',
  OPTIONAL: 'optional',
  READ_ONLY: 'read_only',
});

const POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS = Object.freeze({
  READY: 'ready',
  BLOCKED_BY_BOUNDED_INPUT: 'blocked_by_bounded_input',
  BLOCKED_BY_WORKFLOW_AUDIT: 'blocked_by_workflow_audit',
});

const POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS = Object.freeze({
  IMPACT_PREVIEW: 'impact_preview',
  REPLAY_PREVIEW: 'replay_preview',
  REPLAY_PARITY: 'replay_parity',
  PROVIDER_GATE: 'provider_gate',
  PROVIDER_READINESS: 'provider_readiness',
  TMDB_COVERAGE: 'tmdb_coverage',
  RAW_SCORING: 'raw_scoring',
  DIAGNOSTIC_PANEL: 'diagnostic_panel',
});

const POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS = Object.freeze({
  MISSING_SECTION: 'missing_section',
  UNKNOWN_SECTION: 'unknown_section',
  MISSING_HEADING: 'missing_heading',
  MISSING_QUESTION: 'missing_question',
  MISSING_HELPER: 'missing_helper',
  MISSING_PRIMARY_ACTION: 'missing_primary_action',
  TOO_MANY_PRIMARY_ACTIONS: 'too_many_primary_actions',
  UNKNOWN_CONTROL_KIND: 'unknown_control_kind',
  MISSING_TERM: 'missing_term',
  MISSING_INTENT_FIELD: 'missing_intent_field',
  INTERNAL_LANGUAGE: 'internal_language',
  DIAGNOSTIC_SURFACE_IN_NORMAL_FLOW: 'diagnostic_surface_in_normal_flow',
  READINESS_SECTION_EDITABLE: 'readiness_section_editable',
  MISSING_READINESS: 'missing_readiness',
  ROUTE_SECTION_MISSING_READINESS: 'route_section_missing_readiness',
  DIRECT_EXECUTION: 'direct_execution',
  DIRECT_PERSISTENCE: 'direct_persistence',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  MISSING_NEXT_ACTION: 'missing_next_action',
  MISSING_BOUNDED_INTENT: 'missing_bounded_intent',
  MISSING_BOUNDED_READINESS: 'missing_bounded_readiness',
  MISSING_BOUNDED_PROVENANCE: 'missing_bounded_provenance',
  BOUNDED_PROVENANCE_MISMATCH: 'bounded_provenance_mismatch',
  BOUNDED_INTENT_AUDIT_NOT_PASSING: 'bounded_intent_audit_not_passing',
  BOUNDED_READINESS_AUDIT_NOT_PASSING: 'bounded_readiness_audit_not_passing',
  MISSING_BOUNDED_QUALITY: 'missing_bounded_quality',
  BOUNDED_QUALITY_INSUFFICIENT: 'bounded_quality_insufficient',
  BOUNDED_QUALITY_MISMATCH: 'bounded_quality_mismatch',
});

const REQUIRED_SECTION_IDS = Object.freeze(Object.values(POLICY_OPERATOR_WORKFLOW_SECTION_IDS));
const ALLOWED_CONTROL_KIND_IDS = Object.freeze(Object.values(POLICY_SETUP_FIELD_CONTROL_KIND_IDS));
const PROHIBITED_NORMAL_SURFACE_IDS = Object.freeze(
  Object.values(POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS)
);

const WORKFLOW_EVIDENCE_INPUT_KEYS = Object.freeze([
  'libraryProfile',
  'operatorIntent',
  'classificationOutcomes',
  'manualCorrections',
  'pendingItemAnswers',
  'arrRoutingOutcomes',
  'metadataEvidence',
  'profileFreshness',
]);

const WORKFLOW_SECTION_CONTRACTS = Object.freeze([
  {
    sectionId: POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE,
    heading: 'What belongs here',
    plainQuestion: 'What current examples best define this destination?',
    helperText: 'Start from observed library examples. Accept only the examples that should shape this destination.',
    termIds: [POLICY_UX_TERM_IDS.BELONGS_HERE],
    intentFieldIds: [POLICY_INTENT_FIELD_IDS.BELONGS_HERE],
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.OBSERVED_MULTI_SELECT,
    editable: true,
    primaryActionId: POLICY_OPERATOR_WORKFLOW_ACTION_IDS.ACCEPT_EXAMPLES,
    primaryActionLabel: 'Accept examples',
    targetId: 'policy-builder-belongs-here',
  },
  {
    sectionId: POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_SHOULD_NOT_GO_HERE,
    heading: 'What should not go here',
    plainQuestion: 'Are there clear limits or avoid rules for this destination?',
    helperText: 'Use this only for operator-declared limits or poor-fit signals, not missing examples.',
    termIds: [
      POLICY_UX_TERM_IDS.HARD_LIMITS,
      POLICY_UX_TERM_IDS.AVOID,
    ],
    intentFieldIds: [
      POLICY_INTENT_FIELD_IDS.HARD_LIMITS,
      POLICY_INTENT_FIELD_IDS.AVOID,
    ],
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_MULTI_SELECT,
    editable: true,
    primaryActionId: POLICY_OPERATOR_WORKFLOW_ACTION_IDS.EDIT_LIMITS,
    primaryActionLabel: 'Edit limits',
    targetId: 'policy-builder-limits',
  },
  {
    sectionId: POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_HELPS,
    heading: 'What helps but should not decide alone',
    plainQuestion: 'Which supporting signals help confirm a match after the destination already fits?',
    helperText: 'Helpful signals can raise confidence, but they do not define the destination by themselves.',
    termIds: [POLICY_UX_TERM_IDS.HELPFUL_MATCHES],
    intentFieldIds: [POLICY_INTENT_FIELD_IDS.HELPFUL_MATCHES],
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.OBSERVED_MULTI_SELECT,
    editable: true,
    primaryActionId: POLICY_OPERATOR_WORKFLOW_ACTION_IDS.REVIEW_HELPERS,
    primaryActionLabel: 'Review helpers',
    targetId: 'policy-builder-helpful-matches',
  },
  {
    sectionId: POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHEN_TO_ASK,
    heading: 'When should Classifarr ask',
    plainQuestion: 'When should Classifarr stop and ask before applying this destination?',
    helperText: 'Review triggers describe uncertainty. They are not exclusions by themselves.',
    termIds: [POLICY_UX_TERM_IDS.ASK_WHEN_UNSURE],
    intentFieldIds: [POLICY_INTENT_FIELD_IDS.ASK_WHEN],
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.DECLARED_CHECKLIST,
    editable: true,
    primaryActionId: POLICY_OPERATOR_WORKFLOW_ACTION_IDS.EDIT_REVIEW_TRIGGERS,
    primaryActionLabel: 'Edit review triggers',
    targetId: 'policy-builder-ask-when',
  },
  {
    sectionId: POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE,
    heading: 'Can this route',
    plainQuestion: 'Can confirmed matches be sent to the destination safely?',
    helperText: 'Readiness comes from server checks over intent, routing, freshness, and learning state.',
    termIds: [
      POLICY_UX_TERM_IDS.ROUTING_TARGET,
      POLICY_UX_TERM_IDS.READINESS,
    ],
    intentFieldIds: [POLICY_INTENT_FIELD_IDS.ROUTING_TARGET],
    controlKindId: POLICY_SETUP_FIELD_CONTROL_KIND_IDS.NEXT_ACTION_STATUS,
    editable: false,
    primaryActionId: POLICY_OPERATOR_WORKFLOW_ACTION_IDS.RESOLVE_READINESS,
    primaryActionLabel: 'Resolve readiness',
    targetId: 'policy-builder-readiness',
  },
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildWorkflowEvidenceInput(input = {}) {
  const workflowInput = asObject(input);

  return WORKFLOW_EVIDENCE_INPUT_KEYS.reduce((evidenceInput, key) => {
    if (Object.hasOwn(workflowInput, key)) {
      evidenceInput[key] = workflowInput[key];
    }

    return evidenceInput;
  }, {});
}

function countSectionEntries(section, intent) {
  return section.intentFieldIds
    .reduce((count, fieldId) => count + asArray(intent?.[fieldId]).length, 0);
}

function getSectionStatus(section, intent, readiness) {
  if (section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE) {
    return readiness.ready === true
      ? POLICY_OPERATOR_WORKFLOW_STATUS_IDS.COMPLETE
      : POLICY_OPERATOR_WORKFLOW_STATUS_IDS.NEEDS_ACTION;
  }

  if (section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHAT_BELONGS_HERE) {
    return countSectionEntries(section, intent) > 0
      ? POLICY_OPERATOR_WORKFLOW_STATUS_IDS.COMPLETE
      : POLICY_OPERATOR_WORKFLOW_STATUS_IDS.NEEDS_ACTION;
  }

  if (section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.WHEN_TO_ASK) {
    return countSectionEntries(section, intent) > 0 ||
      readiness.stateId === POLICY_AUTOMATION_READINESS_STATE_IDS.NEEDS_OPERATOR_REVIEW
      ? POLICY_OPERATOR_WORKFLOW_STATUS_IDS.NEEDS_ACTION
      : POLICY_OPERATOR_WORKFLOW_STATUS_IDS.OPTIONAL;
  }

  return countSectionEntries(section, intent) > 0
    ? POLICY_OPERATOR_WORKFLOW_STATUS_IDS.COMPLETE
    : POLICY_OPERATOR_WORKFLOW_STATUS_IDS.OPTIONAL;
}

function mapSectionEntries(section, intent) {
  return section.intentFieldIds.flatMap(fieldId =>
    normalizePolicyOperatorWorkflowEntries(intent?.[fieldId]).map(entry => ({
      ...entry,
      intentFieldId: fieldId,
    }))
  );
}

function mapSectionReadiness(section, readiness) {
  if (section.sectionId !== POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE) {
    const relatedIssues = asArray(readiness.issues)
      .filter(issue => section.intentFieldIds.includes(issue?.nextAction?.target));

    return {
      stateId: relatedIssues[0]?.stateId || null,
      nextAction: relatedIssues[0]?.nextAction || null,
      issueCount: relatedIssues.length,
    };
  }

  return {
    stateId: readiness.stateId,
    ready: readiness.ready,
    nextAction: readiness.nextAction || null,
    issueCount: asArray(readiness.issues).length,
    reasonCodes: asArray(readiness.reasonCodes),
  };
}

function buildWorkflowSection(section, intent, readiness) {
  const statusId = getSectionStatus(section, intent, readiness);

  return {
    sectionId: section.sectionId,
    heading: section.heading,
    plainQuestion: section.plainQuestion,
    helperText: section.helperText,
    termIds: section.termIds,
    intentFieldIds: section.intentFieldIds,
    controlKindId: section.controlKindId,
    editable: section.editable,
    statusId,
    primaryAction: {
      actionId: section.primaryActionId,
      label: section.primaryActionLabel,
      targetId: section.targetId,
    },
    entries: mapSectionEntries(section, intent),
    readiness: mapSectionReadiness(section, readiness),
    executesRouting: false,
    persistsPolicy: false,
    exposesRawPayload: false,
  };
}

function buildPolicyOperatorWorkflow(input = {}) {
  const inferredIntentResult = input.intentDraft?.version === 'policy.intent.v1' ||
    input.intent?.version === 'policy.intent.v1'
    ? null
    : buildPolicyIntentDraftFromEvidenceInput({
      evidenceInput: buildWorkflowEvidenceInput(input),
    });
  const intent = input.intentDraft?.version === 'policy.intent.v1' ||
    input.intent?.version === 'policy.intent.v1'
    ? input.intentDraft || input.intent
    : inferredIntentResult.intent;
  const readiness = input.readiness?.version === 'policy.automation_readiness.v1'
    ? input.readiness
    : buildPolicyAutomationReadinessFromContracts({
      ...(input.evidenceProjection?.version === 'policy.evidence.v1'
        ? { evidenceProjection: input.evidenceProjection }
        : {}),
      ...(intent?.version === 'policy.intent.v1'
        ? { intentDraft: intent }
        : {}),
      learningDecision: input.learningDecision,
      routing: input.routing,
      profileFreshness: input.profileFreshness,
      hardLimitConflict: input.hardLimitConflict,
    });
  const sections = WORKFLOW_SECTION_CONTRACTS.map(section =>
    buildWorkflowSection(section, intent, readiness)
  );

  return {
    version: 'policy.operator_workflow.v1',
    workflowId: 'destination_first_policy_setup',
    title: 'Destination setup',
    summary: 'Review what belongs here, what should not, when to ask, and whether confirmed matches can route.',
    sectionOrder: REQUIRED_SECTION_IDS,
    sections,
    readiness: {
      stateId: readiness.stateId,
      ready: readiness.ready,
      nextAction: readiness.nextAction,
      reasonCodes: asArray(readiness.reasonCodes),
    },
    normalWorkflowExclusions: PROHIBITED_NORMAL_SURFACE_IDS,
    decisionModel: {
      onePrimaryActionPerSection: true,
      serverOwnsReadiness: true,
      clientMayPersistDirectly: false,
      clientMayExecuteRouting: false,
      diagnosticPanelsAllowedInNormalFlow: false,
    },
  };
}

function getProjectionFingerprintFromIntentResult(boundedIntentResult = {}) {
  return boundedIntentResult?.evidenceBoundary?.projectionFingerprint?.fingerprint || null;
}

function getProjectionFingerprintFromReadinessResult(boundedReadinessResult = {}) {
  return boundedReadinessResult?.boundaryContext?.intentBoundary?.projectionFingerprint?.fingerprint ||
    boundedReadinessResult?.boundaryContext?.evidenceBoundary?.projectionFingerprint?.fingerprint ||
    null;
}

function boundedIntentAuditsPass(boundedIntentResult = {}) {
  return boundedIntentResult?.intentAudit?.ok === true &&
    boundedIntentResult?.evidenceFingerprintAudit?.ok === true;
}

function boundedReadinessAuditPasses(boundedReadinessResult = {}) {
  return boundedReadinessResult?.readinessAudit?.ok === true;
}

function normalizeQualitySnapshot(quality = null) {
  const normalized = asObject(quality);
  const reasonIds = asArray(normalized.reasonIds)
    .map(reasonId => normalizeString(reasonId))
    .filter(Boolean)
    .sort();

  return {
    version: normalized.version || null,
    statusId: normalized.statusId || null,
    score: Number.isFinite(Number(normalized.score)) ? Number(normalized.score) : null,
    nextActionId: normalized.nextActionId || null,
    reasonIds,
    counts: asObject(normalized.counts),
    hasIdentityEvidence: normalized.hasIdentityEvidence === true,
    hasDeclaredIdentityEvidence: normalized.hasDeclaredIdentityEvidence === true,
    hasObservedIdentityEvidence: normalized.hasObservedIdentityEvidence === true,
    hasStaleProfileEvidence: normalized.hasStaleProfileEvidence === true,
  };
}

function hasQualitySnapshot(quality = null) {
  return Boolean(normalizeQualitySnapshot(quality).statusId);
}

function qualitySnapshotsMatch(left = null, right = null) {
  const leftSnapshot = normalizeQualitySnapshot(left);
  const rightSnapshot = normalizeQualitySnapshot(right);

  return Boolean(leftSnapshot.statusId) &&
    leftSnapshot.version === rightSnapshot.version &&
    leftSnapshot.statusId === rightSnapshot.statusId &&
    leftSnapshot.nextActionId === rightSnapshot.nextActionId &&
    leftSnapshot.reasonIds.join('|') === rightSnapshot.reasonIds.join('|');
}

function getReadinessBoundaryContext(boundedReadinessResult = {}) {
  return asObject(boundedReadinessResult.boundaryContext);
}

function getReadinessInputBoundaryContext(boundedReadinessResult = {}) {
  return asObject(boundedReadinessResult.readiness?.inputs?.boundaryContext);
}

function getWorkflowQualitySnapshots({
  boundedIntentResult,
  boundedReadinessResult,
} = {}) {
  const readinessBoundaryContext = getReadinessBoundaryContext(boundedReadinessResult);
  const readinessInputBoundaryContext = getReadinessInputBoundaryContext(boundedReadinessResult);

  return {
    intentWrapperQuality: boundedIntentResult?.evidenceBoundary?.quality || null,
    readinessEvidenceQuality: readinessBoundaryContext.evidenceBoundary?.quality || null,
    readinessIntentQuality: readinessBoundaryContext.intentBoundary?.quality || null,
    readinessLearningQuality: readinessBoundaryContext.learningBoundary?.quality || null,
    embeddedReadinessEvidenceQuality:
      readinessInputBoundaryContext.evidenceBoundary?.quality || null,
    embeddedReadinessIntentQuality:
      readinessInputBoundaryContext.intentBoundary?.quality || null,
    embeddedReadinessLearningQuality:
      readinessInputBoundaryContext.learningBoundary?.quality || null,
  };
}

function collectBoundedWorkflowQualityIssues({
  boundedIntentResult,
  boundedReadinessResult,
} = {}) {
  const issues = [];
  const snapshots = getWorkflowQualitySnapshots({
    boundedIntentResult,
    boundedReadinessResult,
  });
  const qualityValues = Object.values(snapshots);

  if (qualityValues.some(quality => !hasQualitySnapshot(quality))) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      message: 'Operator workflow requires bounded readiness quality snapshots from intent, readiness, and embedded readiness context.',
    });
    return issues;
  }

  const normalizedSnapshots = qualityValues.map(quality => normalizeQualitySnapshot(quality));
  const insufficientQuality = normalizedSnapshots.find(quality =>
    quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT
  );

  if (insufficientQuality) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
      message: 'Operator workflow requires usable bounded evidence quality before rendering.',
      qualityStatusId: insufficientQuality.statusId,
      nextActionId: insufficientQuality.nextActionId,
      reasonIds: insufficientQuality.reasonIds,
    });
  }

  const referenceQuality = snapshots.intentWrapperQuality;
  const qualityMismatch = qualityValues.some(quality =>
    !qualitySnapshotsMatch(referenceQuality, quality)
  );

  if (qualityMismatch) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
      message: 'Operator workflow requires bounded intent, readiness, and embedded readiness quality to match.',
    });
  }

  return issues;
}

function collectWorkflowBoundaryContextQualityIssues(boundaryContext = {}) {
  const context = asObject(boundaryContext);
  if (!Object.keys(context).length) return [];

  const qualities = [
    context.intentBoundary?.quality,
    context.readinessBoundary?.evidenceQuality,
    context.readinessBoundary?.intentQuality,
    context.readinessBoundary?.learningQuality,
  ];

  if (qualities.some(quality => !hasQualitySnapshot(quality))) {
    return [{
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_QUALITY,
      message: 'Bounded workflow context must retain sanitized quality snapshots.',
    }];
  }

  const insufficientQuality = qualities
    .map(quality => normalizeQualitySnapshot(quality))
    .find(quality => quality.statusId === POLICY_EVIDENCE_QUALITY_STATUS_IDS.INSUFFICIENT);

  if (insufficientQuality) {
    return [{
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_INSUFFICIENT,
      message: 'Bounded workflow context cannot carry insufficient quality into the normal workflow.',
      qualityStatusId: insufficientQuality.statusId,
      nextActionId: insufficientQuality.nextActionId,
      reasonIds: insufficientQuality.reasonIds,
    }];
  }

  const qualityMismatch = qualities.some(quality => !qualitySnapshotsMatch(qualities[0], quality));
  return qualityMismatch
    ? [{
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_QUALITY_MISMATCH,
        message: 'Bounded workflow context quality snapshots must match.',
      }]
    : [];
}

function buildBoundedWorkflowContext({
  boundedIntentResult,
  boundedReadinessResult,
} = {}) {
  const intentFingerprint = getProjectionFingerprintFromIntentResult(boundedIntentResult);
  const readinessFingerprint = getProjectionFingerprintFromReadinessResult(boundedReadinessResult);
  const readinessBoundaryContext = getReadinessBoundaryContext(boundedReadinessResult);

  if (!intentFingerprint || !readinessFingerprint) {
    return null;
  }

  return {
    intentBoundary: {
      statusId: boundedIntentResult.statusId || null,
      intentVersion: boundedIntentResult.intent?.version || null,
      intentAuditOk: boundedIntentAuditsPass(boundedIntentResult),
      quality: normalizeQualitySnapshot(boundedIntentResult.evidenceBoundary?.quality),
      projectionFingerprint:
        boundedIntentResult.evidenceBoundary?.projectionFingerprint || null,
    },
    readinessBoundary: {
      statusId: boundedReadinessResult.statusId || null,
      readinessStateId: boundedReadinessResult.readiness?.stateId || null,
      readinessAuditOk: boundedReadinessAuditPasses(boundedReadinessResult),
      evidenceQuality:
        normalizeQualitySnapshot(readinessBoundaryContext.evidenceBoundary?.quality),
      intentQuality:
        normalizeQualitySnapshot(readinessBoundaryContext.intentBoundary?.quality),
      learningQuality:
        normalizeQualitySnapshot(readinessBoundaryContext.learningBoundary?.quality),
      projectionFingerprint:
        readinessBoundaryContext.intentBoundary?.projectionFingerprint ||
        readinessBoundaryContext.evidenceBoundary?.projectionFingerprint ||
        null,
      projectionFingerprintMatch:
        readinessBoundaryContext.projectionFingerprintMatch === true,
    },
    projectionFingerprintMatch:
      intentFingerprint === readinessFingerprint &&
      readinessBoundaryContext.projectionFingerprintMatch === true,
    qualityMatch: collectBoundedWorkflowQualityIssues({
      boundedIntentResult,
      boundedReadinessResult,
    }).length === 0,
  };
}

function buildPolicyOperatorWorkflowFromBoundedReadiness({
  boundedIntentResult,
  boundedReadinessResult,
} = {}) {
  const boundaryIssues = [];

  if (boundedIntentResult?.ok !== true || !boundedIntentResult?.intent) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_INTENT,
      message: 'Operator workflow requires a successful bounded intent result.',
    });
  }

  if (boundedReadinessResult?.ok !== true || !boundedReadinessResult?.readiness) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_READINESS,
      message: 'Operator workflow requires a successful bounded readiness result.',
    });
  }

  if (
    boundedIntentResult?.ok === true &&
    boundedIntentResult?.intent &&
    !boundedIntentAuditsPass(boundedIntentResult)
  ) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_INTENT_AUDIT_NOT_PASSING,
      message: 'Operator workflow requires passing bounded intent and evidence-fingerprint audits.',
    });
  }

  if (
    boundedReadinessResult?.ok === true &&
    boundedReadinessResult?.readiness &&
    !boundedReadinessAuditPasses(boundedReadinessResult)
  ) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_READINESS_AUDIT_NOT_PASSING,
      message: 'Operator workflow requires a passing bounded readiness audit.',
    });
  }

  if (
    boundedIntentResult?.ok === true &&
    boundedReadinessResult?.ok === true &&
    boundedIntentResult?.intent &&
    boundedReadinessResult?.readiness
  ) {
    boundaryIssues.push(...collectBoundedWorkflowQualityIssues({
      boundedIntentResult,
      boundedReadinessResult,
    }));
  }

  const boundaryContext = buildBoundedWorkflowContext({
    boundedIntentResult,
    boundedReadinessResult,
  });

  if (!boundaryContext) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_BOUNDED_PROVENANCE,
      message: 'Operator workflow requires bounded evidence provenance.',
    });
  } else if (boundaryContext.projectionFingerprintMatch !== true) {
    boundaryIssues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.BOUNDED_PROVENANCE_MISMATCH,
      message: 'Operator workflow requires intent and readiness to reference the same evidence projection.',
    });
  }

  if (boundaryIssues.length > 0) {
    return {
      ok: false,
      statusId: POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_BOUNDED_INPUT,
      boundaryContext,
      workflow: null,
      workflowAudit: null,
      issueCount: boundaryIssues.length,
      issues: boundaryIssues,
      nextStep: null,
    };
  }

  const workflow = buildPolicyOperatorWorkflow({
    intentDraft: boundedIntentResult.intent,
    readiness: boundedReadinessResult.readiness,
  });
  workflow.boundaryContext = boundaryContext;
  workflow.decisionModel.serverOwnsBoundedReadiness = true;
  const workflowAudit = buildPolicyOperatorWorkflowAudit(workflow);
  const ok = workflowAudit.ok === true;

  return {
    ok,
    statusId: ok
      ? POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.READY
      : POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS.BLOCKED_BY_WORKFLOW_AUDIT,
    boundaryContext,
    workflow,
    workflowAudit,
    issueCount: workflowAudit.issueCount,
    issues: workflowAudit.validation.issues,
    nextStep: ok ? workflowAudit.nextStep : null,
  };
}

function sectionContainsInternalLanguage(section = {}) {
  return [
    section.heading,
    section.plainQuestion,
    section.helperText,
    section.primaryAction?.label,
  ].some(value => includesInternalPolicyLanguage(value));
}

function validateWorkflowSection(section = {}) {
  const issues = [];

  if (!REQUIRED_SECTION_IDS.includes(section.sectionId)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.UNKNOWN_SECTION,
      message: 'Workflow section must be part of the policy operator workflow section set.',
    });
  }

  if (!normalizeString(section.heading)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_HEADING,
      message: 'Workflow section must have a heading.',
    });
  }

  if (!normalizeString(section.plainQuestion)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_QUESTION,
      message: 'Workflow section must have one plain operator question.',
    });
  }

  if (!normalizeString(section.helperText)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_HELPER,
      message: 'Workflow section must have helper text.',
    });
  }

  const primaryActions = [section.primaryAction].filter(action => action?.actionId);
  if (primaryActions.length === 0) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_PRIMARY_ACTION,
      message: 'Workflow section must expose one primary action.',
    });
  }
  if (primaryActions.length > 1) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.TOO_MANY_PRIMARY_ACTIONS,
      message: 'Workflow section must not expose multiple primary actions.',
    });
  }

  if (!ALLOWED_CONTROL_KIND_IDS.includes(section.controlKindId)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.UNKNOWN_CONTROL_KIND,
      message: 'Workflow section must use an approved setup control kind.',
    });
  }

  if (asArray(section.termIds).length === 0) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_TERM,
      message: 'Workflow section must map to approved policy-authoring terms.',
    });
  }

  if (asArray(section.intentFieldIds).length === 0) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_INTENT_FIELD,
      message: 'Workflow section must map to policy intent fields.',
    });
  }

  if (sectionContainsInternalLanguage(section)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.INTERNAL_LANGUAGE,
      message: 'Workflow section copy must not expose internal diagnostic language.',
    });
  }

  if (section.sectionId === POLICY_OPERATOR_WORKFLOW_SECTION_IDS.CAN_THIS_ROUTE) {
    if (section.editable === true) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.READINESS_SECTION_EDITABLE,
        message: 'The readiness section must be read-only.',
      });
    }

    if (!section.readiness?.stateId) {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.ROUTE_SECTION_MISSING_READINESS,
        message: 'The routing/readiness section must include the readiness state.',
      });
    }
  }

  if (section.executesRouting === true) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_EXECUTION,
      message: 'Workflow sections cannot execute routing directly.',
    });
  }

  if (section.persistsPolicy === true) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_PERSISTENCE,
      message: 'Workflow sections cannot persist policy directly.',
    });
  }

  if (section.exposesRawPayload === true ||
      asArray(section.entries).some(entry => !buildPolicyOperatorWorkflowEntryAudit(entry).ok)) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Workflow sections cannot expose raw provider or diagnostic payloads.',
    });
  }

  return issues;
}

function validatePolicyOperatorWorkflow(workflow = {}) {
  const issues = [];
  const sectionIds = asArray(workflow.sections).map(section => section.sectionId);

  REQUIRED_SECTION_IDS
    .filter(sectionId => !sectionIds.includes(sectionId))
    .forEach(sectionId => {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_SECTION,
        message: `Workflow is missing required section "${sectionId}".`,
      });
    });

  asArray(workflow.sections).forEach(section => {
    issues.push(...validateWorkflowSection(section));
  });

  if (!workflow.readiness?.stateId) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_READINESS,
      message: 'Workflow must include server-owned readiness.',
    });
  }

  if (workflow.readiness?.ready !== true && !workflow.readiness?.nextAction?.actionId) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.MISSING_NEXT_ACTION,
      message: 'Non-ready workflow must include a readiness next action.',
    });
  }

  const exclusions = asArray(workflow.normalWorkflowExclusions);
  PROHIBITED_NORMAL_SURFACE_IDS
    .filter(surfaceId => !exclusions.includes(surfaceId))
    .forEach(surfaceId => {
      issues.push({
        riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIAGNOSTIC_SURFACE_IN_NORMAL_FLOW,
        message: `Workflow must explicitly exclude "${surfaceId}" from the normal flow.`,
      });
    });

  if (workflow.decisionModel?.diagnosticPanelsAllowedInNormalFlow === true) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIAGNOSTIC_SURFACE_IN_NORMAL_FLOW,
      message: 'Diagnostic panels are not allowed in the normal policy operator workflow.',
    });
  }

  if (workflow.decisionModel?.clientMayPersistDirectly === true) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_PERSISTENCE,
      message: 'The workflow cannot let the client persist policy directly.',
    });
  }

  if (workflow.decisionModel?.clientMayExecuteRouting === true) {
    issues.push({
      riskId: POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS.DIRECT_EXECUTION,
      message: 'The workflow cannot let the client execute routing directly.',
    });
  }

  issues.push(...collectWorkflowBoundaryContextQualityIssues(workflow.boundaryContext));

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    sectionCount: asArray(workflow.sections).length,
    issues,
  };
}

function buildPolicyOperatorWorkflowAudit(
  workflow = buildPolicyOperatorWorkflow()
) {
  const validation = validatePolicyOperatorWorkflow(workflow);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    checkedSectionCount: validation.sectionCount,
    requiredSectionCount: REQUIRED_SECTION_IDS.length,
    prohibitedNormalSurfaceCount: PROHIBITED_NORMAL_SURFACE_IDS.length,
    validation,
    nextStep: {
      stepId: 'migration_deletion_path',
      label: 'Policy Migration Deletion Path',
      reason: 'The operator workflow now has a destination-first server contract, so replaced diagnostic surfaces can be classified for migration verification or deletion.',
    },
  };
}

function listPolicyOperatorWorkflowSections() {
  return WORKFLOW_SECTION_CONTRACTS;
}

function getPolicyOperatorWorkflowSection(sectionId) {
  return WORKFLOW_SECTION_CONTRACTS.find(section => section.sectionId === sectionId) || null;
}

export {
  POLICY_OPERATOR_WORKFLOW_ACTION_IDS,
  POLICY_OPERATOR_WORKFLOW_AUDIT_RISK_IDS,
  POLICY_OPERATOR_WORKFLOW_BOUNDARY_STATUS_IDS,
  POLICY_OPERATOR_WORKFLOW_PROHIBITED_NORMAL_SURFACE_IDS,
  POLICY_OPERATOR_WORKFLOW_SECTION_IDS,
  POLICY_OPERATOR_WORKFLOW_STATUS_IDS,
  buildPolicyOperatorWorkflow,
  buildPolicyOperatorWorkflowFromBoundedReadiness,
  buildPolicyOperatorWorkflowAudit,
  getPolicyOperatorWorkflowSection,
  listPolicyOperatorWorkflowSections,
  validatePolicyOperatorWorkflow,
};
