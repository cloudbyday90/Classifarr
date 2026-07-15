import {
  POLICY_MIGRATION_VERIFIER_STATUS_IDS,
} from './policyMigrationVerifierRollback.mjs';
import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';
import {
  POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS,
  buildPolicyIntentMigrationCandidateReport,
  validatePolicyIntentMigrationCandidateReport,
} from './policyIntentMigrationCandidateReport.mjs';
import {
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
} from './policyNativeSchemaContract.mjs';

const POLICY_INTENT_CONVERSION_WORKFLOW_VERSION = 'policy.intent_conversion_workflow.v1';
const POLICY_INTENT_CONVERSION_ROLLBACK_WINDOW_DAYS = 14;
const POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS = POLICY_CONVERSION_ACTOR_SOURCE_IDS;

const POLICY_INTENT_CONVERSION_STEP_STATUS_IDS = Object.freeze({
  READY_TO_APPLY: 'ready_to_apply',
  BLOCKED_BY_ACTOR_SOURCE: 'blocked_by_actor_source',
  BLOCKED_BY_NOT_SELECTED: 'blocked_by_not_selected',
  BLOCKED_BY_CANDIDATE_STATUS: 'blocked_by_candidate_status',
  BLOCKED_BY_SERVER_VALIDATION: 'blocked_by_server_validation',
  BLOCKED_BY_VERIFIER: 'blocked_by_verifier',
  BLOCKED_BY_ROLLBACK_SNAPSHOT: 'blocked_by_rollback_snapshot',
  ALREADY_CONVERTED: 'already_converted',
});

const POLICY_INTENT_CONVERSION_REASON_IDS = Object.freeze({
  SELECTED_FOR_CONVERSION: 'selected_for_conversion',
  CANDIDATE_READY: 'candidate_ready',
  CANDIDATE_NOT_READY: 'candidate_not_ready',
  SERVER_VALIDATION_REQUIRED: 'server_validation_required',
  VERIFIER_REQUIRED: 'verifier_required',
  VERIFIER_PASSED: 'verifier_passed',
  VERIFIER_BLOCKED: 'verifier_blocked',
  ROLLBACK_SNAPSHOT_REQUIRED: 'rollback_snapshot_required',
  ROLLBACK_SNAPSHOT_PLANNED: 'rollback_snapshot_planned',
  MIGRATION_EVENT_PLANNED: 'migration_event_planned',
  NATIVE_RECORDS_PLANNED: 'native_records_planned',
  IDEMPOTENCY_KEY_ASSIGNED: 'idempotency_key_assigned',
  ORDINARY_READ_WRITE_BLOCKED: 'ordinary_read_write_blocked',
  LEGACY_BEHAVIOR_RETAINED_UNTIL_COMMIT: 'legacy_behavior_retained_until_commit',
});

const POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS = Object.freeze({
  INVALID_CANDIDATE_REPORT: 'invalid_candidate_report',
  UNKNOWN_ACTOR_SOURCE: 'unknown_actor_source',
  ORDINARY_READ_OR_SAVE_CONVERSION: 'ordinary_read_or_save_conversion',
  MISSING_SELECTION: 'missing_selection',
  READY_STEP_WITHOUT_READY_CANDIDATE: 'ready_step_without_ready_candidate',
  READY_STEP_WITHOUT_SERVER_VALIDATION: 'ready_step_without_server_validation',
  READY_STEP_WITHOUT_ROLLBACK: 'ready_step_without_rollback',
  READY_STEP_WITHOUT_MIGRATION_EVENT: 'ready_step_without_migration_event',
  READY_STEP_WITHOUT_NATIVE_RECORDS: 'ready_step_without_native_records',
  BEHAVIOR_SENSITIVE_WITHOUT_VERIFIER: 'behavior_sensitive_without_verifier',
  BEHAVIOR_SENSITIVE_VERIFIER_NOT_PASSED: 'behavior_sensitive_verifier_not_passed',
  MISSING_IDEMPOTENCY_KEY: 'missing_idempotency_key',
  FAILED_CONVERSION_MUTATES_LEGACY: 'failed_conversion_mutates_legacy',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const ALLOWED_ACTOR_SOURCE_IDS = Object.freeze([
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION,
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildReason(reasonId, message, severity = 'info', metadata = {}) {
  return {
    reasonId,
    severity,
    message,
    ...metadata,
  };
}

function buildIdempotencyKey(policyId, targetVersion = 1) {
  return `policy-intent:convert:${policyId}:v${targetVersion}`;
}

function buildDefaultRollbackExpiry(options = {}) {
  if (options.rollbackSnapshot?.expiresAt) return options.rollbackSnapshot.expiresAt;

  const createdAt = options.now ? new Date(options.now) : new Date();
  const validCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  validCreatedAt.setUTCDate(validCreatedAt.getUTCDate() + POLICY_INTENT_CONVERSION_ROLLBACK_WINDOW_DAYS);
  return validCreatedAt.toISOString();
}

function getVerifierReport(verifierReports, policyId) {
  return asArray(verifierReports).find(report =>
    String(report.policyId ?? report.policy_id) === String(policyId)
  );
}

function isVerifierPassed(verifierReport) {
  if (!verifierReport) return false;
  return verifierReport.statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.NO_MIGRATION_DIFFERENCES ||
    (
      verifierReport.statusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.REVIEW_REQUIRED &&
      verifierReport.applicationGate?.operatorAccepted === true
    );
}

function buildRollbackSnapshotPlan(candidate, options = {}) {
  const targetVersion = options.targetVersion ?? 1;
  return {
    planned: options.rollbackSnapshot?.planned !== false,
    tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
    policyId: candidate.policyId,
    snapshotVersion: targetVersion,
    payloadRedacted: true,
    restorePath: `policy/rollback/policies/${candidate.policyId}/v${targetVersion}`,
    expiresAt: buildDefaultRollbackExpiry(options),
    retentionWindowDays: POLICY_INTENT_CONVERSION_ROLLBACK_WINDOW_DAYS,
    reasonId: POLICY_INTENT_CONVERSION_REASON_IDS.ROLLBACK_SNAPSHOT_PLANNED,
  };
}

function buildNativeRecordPlan(candidate, options = {}) {
  const targetVersion = options.targetVersion ?? 1;
  return [
    {
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENTS,
      policyId: candidate.policyId,
      libraryId: candidate.libraryId,
      intentVersion: targetVersion,
      source: candidate.intentContract.source,
      inferenceState: candidate.intentContract.inferenceState,
    },
    {
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_RULES,
      policyId: candidate.policyId,
      intentVersion: targetVersion,
      sourceContract: 'policy_intent_contract',
    },
    {
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROUTING_TARGETS,
      policyId: candidate.policyId,
      routingTarget: candidate.routingTarget,
    },
    {
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_TEMPLATE_APPLICATIONS,
      policyId: candidate.policyId,
      sourceContract: 'template_links',
    },
    {
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_VALIDATION_STATUS,
      policyId: candidate.policyId,
      status: 'valid',
      errorCount: candidate.intentContract.errorCount,
      warningCount: candidate.intentContract.warningCount,
    },
  ];
}

function buildMigrationEventPlan(candidate, action = {}, options = {}) {
  const targetVersion = options.targetVersion ?? 1;
  return {
    planned: true,
    tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_MIGRATION_EVENTS,
    policyId: candidate.policyId,
    eventType: 'native_intent_conversion_planned',
    actorSourceId: action.actorSourceId,
    actorId: action.actorId ?? null,
    sourceVersion: null,
    targetVersion,
    reasonCode: 'policy_intent_conversion',
  };
}

function buildConversionStep({
  candidate,
  selected,
  action,
  verifierReports,
  behaviorSensitivePolicyIds,
  options,
}) {
  const reasons = [];
  const targetVersion = options.targetVersion ?? 1;
  const actorAllowed = ALLOWED_ACTOR_SOURCE_IDS.includes(action.actorSourceId);
  const behaviorSensitive = behaviorSensitivePolicyIds.has(String(candidate.policyId));
  const verifierReport = getVerifierReport(verifierReports, candidate.policyId);
  const verifierPassed = !behaviorSensitive || isVerifierPassed(verifierReport);
  const rollbackSnapshot = buildRollbackSnapshotPlan(candidate, options);
  const nativeRecords = buildNativeRecordPlan(candidate, options);
  const migrationEvent = buildMigrationEventPlan(candidate, action, options);
  let statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY;

  if (!actorAllowed) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_ACTOR_SOURCE;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.ORDINARY_READ_WRITE_BLOCKED,
      'Conversion can only run from an explicit operator, native reconciliation, post-upgrade, fixture, or maintainer migration action.',
      'blocker'
    ));
  } else if (!selected) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_NOT_SELECTED;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.CANDIDATE_NOT_READY,
      'Policy was not selected for conversion in this explicit action.',
      'blocker'
    ));
  } else if (candidate.alreadyConverted === true) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.ALREADY_CONVERTED;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.IDEMPOTENCY_KEY_ASSIGNED,
      'Policy already has native intent for the requested version.',
      'info'
    ));
  } else if (candidate.statusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_CANDIDATE_STATUS;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.CANDIDATE_NOT_READY,
      'Migration candidate report does not mark this policy ready to convert.',
      'blocker',
      { candidateStatusId: candidate.statusId }
    ));
  } else if (candidate.intentContract?.valid !== true) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_SERVER_VALIDATION;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.SERVER_VALIDATION_REQUIRED,
      'Server intent validation must pass before native rows are inserted.',
      'blocker'
    ));
  } else if (behaviorSensitive && !verifierPassed) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_VERIFIER;
    reasons.push(buildReason(
      verifierReport
        ? POLICY_INTENT_CONVERSION_REASON_IDS.VERIFIER_BLOCKED
        : POLICY_INTENT_CONVERSION_REASON_IDS.VERIFIER_REQUIRED,
      'Behavior-sensitive policies require migration verifier evidence before conversion.',
      'blocker'
    ));
  } else if (rollbackSnapshot.planned !== true) {
    statusId = POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.BLOCKED_BY_ROLLBACK_SNAPSHOT;
    reasons.push(buildReason(
      POLICY_INTENT_CONVERSION_REASON_IDS.ROLLBACK_SNAPSHOT_REQUIRED,
      'Rollback snapshot must be planned before conversion.',
      'blocker'
    ));
  }

  if (statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY) {
    reasons.push(
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.SELECTED_FOR_CONVERSION,
        'Policy was selected by an explicit conversion action.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.CANDIDATE_READY,
        'Migration candidate report marks this policy ready to convert.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.SERVER_VALIDATION_REQUIRED,
        'Server validation is required before native insert/update.'
      ),
      buildReason(
        behaviorSensitive
          ? POLICY_INTENT_CONVERSION_REASON_IDS.VERIFIER_PASSED
          : POLICY_INTENT_CONVERSION_REASON_IDS.VERIFIER_REQUIRED,
        behaviorSensitive
          ? 'Migration verifier passed or was operator-accepted.'
          : 'Policy is not marked behavior-sensitive for this conversion action.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.ROLLBACK_SNAPSHOT_PLANNED,
        'Rollback snapshot is planned before conversion.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.MIGRATION_EVENT_PLANNED,
        'Migration event is planned for the explicit conversion action.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.NATIVE_RECORDS_PLANNED,
        'Native intent records are planned for all required policy intent tables.'
      ),
      buildReason(
        POLICY_INTENT_CONVERSION_REASON_IDS.LEGACY_BEHAVIOR_RETAINED_UNTIL_COMMIT,
        'Legacy behavior remains active until the conversion transaction commits.'
      )
    );
  }

  reasons.push(buildReason(
    POLICY_INTENT_CONVERSION_REASON_IDS.IDEMPOTENCY_KEY_ASSIGNED,
    'Conversion action has a deterministic idempotency key.'
  ));

  return {
    policyId: candidate.policyId,
    policyName: candidate.policyName,
    selected,
    statusId,
    readyToApply: statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY,
    candidateStatusId: candidate.statusId,
    behaviorSensitive,
    verifierStatusId: verifierReport?.statusId || null,
    rollbackSnapshot,
    migrationEvent,
    nativeRecords,
    idempotencyKey: buildIdempotencyKey(candidate.policyId, targetVersion),
    legacyBehaviorRetainedUntilCommit: true,
    reasons,
  };
}

function summarizeSteps(steps) {
  return {
    totalStepCount: steps.length,
    readyToApplyCount: steps.filter(step =>
      step.statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY
    ).length,
    blockedCount: steps.filter(step =>
      ![
        POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY,
        POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.ALREADY_CONVERTED,
      ].includes(step.statusId)
    ).length,
    alreadyConvertedCount: steps.filter(step =>
      step.statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.ALREADY_CONVERTED
    ).length,
  };
}

function buildPolicyIntentConversionWorkflow({
  policies = [],
  candidateReport = null,
  selectedPolicyIds = [],
  action = {},
  verifierReports = [],
  behaviorSensitivePolicyIds = [],
  rollbackSnapshot = {},
  targetVersion = 1,
  now = null,
} = {}) {
  const report = candidateReport || buildPolicyIntentMigrationCandidateReport({ policies });
  const selected = new Set(asArray(selectedPolicyIds).map(policyId => String(policyId)));
  const behaviorSensitive = new Set(asArray(behaviorSensitivePolicyIds).map(policyId => String(policyId)));
  const normalizedAction = {
    actorSourceId: normalizeString(action.actorSourceId || action.source || action.actor_source_id),
    actorId: action.actorId ?? action.actor_id ?? null,
    requestedAt: action.requestedAt || action.requested_at || null,
    reasonCode: normalizeString(action.reasonCode || action.reason_code) || 'policy_intent_conversion',
  };
  const steps = asArray(report.candidates).map(candidate => buildConversionStep({
    candidate,
    selected: selected.has(String(candidate.policyId)),
    action: normalizedAction,
    verifierReports,
    behaviorSensitivePolicyIds: behaviorSensitive,
    options: {
      rollbackSnapshot,
      targetVersion,
      now,
    },
  }));
  const workflow = {
    version: POLICY_INTENT_CONVERSION_WORKFLOW_VERSION,
    mode: 'plan_only',
    action: normalizedAction,
    candidateReportSummary: report.summary || null,
    selectedPolicyIds: [...selected],
    steps,
    summary: summarizeSteps(steps),
    transactionalBoundary: {
      required: true,
      nativeWritesAfterRollbackSnapshot: true,
      migrationEventInSameTransaction: true,
      legacyBehaviorRetainedUntilCommit: true,
      failedConversionLeavesLegacyActive: true,
    },
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
    },
    nextStep: {
      stepId: 'native_runtime_read_path',
      label: 'Native Runtime Read Path',
      reason: 'Conversion actions are now explicit and reversible, so converted policies need a native read path that preserves the same product contract.',
    },
  };

  return {
    ...workflow,
    validation: validatePolicyIntentConversionWorkflow(workflow, report),
  };
}

function validatePolicyIntentConversionWorkflow(workflow = {}, candidateReport = null) {
  const issues = [];
  const steps = asArray(workflow.steps);
  const reportValidation = candidateReport
    ? validatePolicyIntentMigrationCandidateReport(candidateReport)
    : { ok: true, issues: [] };

  if (!reportValidation.ok) {
    issues.push({
      riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.INVALID_CANDIDATE_REPORT,
      message: 'Explicit conversion requires a valid policy intent migration candidate report.',
      details: reportValidation.issues,
    });
  }

  if (!ALLOWED_ACTOR_SOURCE_IDS.includes(workflow.action?.actorSourceId)) {
    issues.push({
      riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.UNKNOWN_ACTOR_SOURCE,
      actorSourceId: workflow.action?.actorSourceId || null,
      message: 'Conversion action source is not approved for explicit conversion.',
    });
  }

  if (
    [
      POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.ORDINARY_POLICY_READ,
      POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS.UNRELATED_POLICY_SAVE,
    ].includes(workflow.action?.actorSourceId)
  ) {
    issues.push({
      riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.ORDINARY_READ_OR_SAVE_CONVERSION,
      message: 'Conversion cannot run from ordinary policy read or unrelated save flows.',
    });
  }

  if (asArray(workflow.selectedPolicyIds).length === 0) {
    issues.push({
      riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.MISSING_SELECTION,
      message: 'Explicit conversion workflow must include selected policy ids.',
    });
  }

  steps.forEach(step => {
    if (asArray(step.reasons).length === 0) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.MISSING_REASON,
        policyId: step.policyId,
        message: 'Conversion step must include bounded reasons.',
      });
    }

    if (step.statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY) {
      if (step.candidateStatusId !== POLICY_INTENT_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_READY_CANDIDATE,
          policyId: step.policyId,
          message: 'Ready conversion steps require a ready migration candidate.',
        });
      }

      if (!step.reasons.some(reason =>
        reason.reasonId === POLICY_INTENT_CONVERSION_REASON_IDS.SERVER_VALIDATION_REQUIRED
      )) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_SERVER_VALIDATION,
          policyId: step.policyId,
          message: 'Ready conversion steps must require server validation.',
        });
      }

      if (step.rollbackSnapshot?.planned !== true) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_ROLLBACK,
          policyId: step.policyId,
          message: 'Ready conversion steps must plan rollback snapshot creation.',
        });
      }

      if (!normalizeString(step.rollbackSnapshot?.expiresAt)) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_ROLLBACK,
          policyId: step.policyId,
          message: 'Ready conversion steps must include a bounded rollback snapshot expiry.',
        });
      }

      if (step.migrationEvent?.planned !== true) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_MIGRATION_EVENT,
          policyId: step.policyId,
          message: 'Ready conversion steps must plan a migration event.',
        });
      }

      if (asArray(step.nativeRecords).length === 0) {
        issues.push({
          riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.READY_STEP_WITHOUT_NATIVE_RECORDS,
          policyId: step.policyId,
          message: 'Ready conversion steps must plan native intent records.',
        });
      }
    }

    if (
      step.behaviorSensitive === true &&
      !step.verifierStatusId &&
      step.statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY
    ) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.BEHAVIOR_SENSITIVE_WITHOUT_VERIFIER,
        policyId: step.policyId,
        message: 'Behavior-sensitive conversion cannot be ready without migration verifier output.',
      });
    }

    if (
      step.behaviorSensitive === true &&
      step.verifierStatusId === POLICY_MIGRATION_VERIFIER_STATUS_IDS.BLOCKED_BY_MIGRATION_RISK &&
      step.statusId === POLICY_INTENT_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY
    ) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.BEHAVIOR_SENSITIVE_VERIFIER_NOT_PASSED,
        policyId: step.policyId,
        message: 'Behavior-sensitive conversion cannot be ready while verifier is blocked.',
      });
    }

    if (!normalizeString(step.idempotencyKey)) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.MISSING_IDEMPOTENCY_KEY,
        policyId: step.policyId,
        message: 'Every conversion step needs an idempotency key.',
      });
    }

    if (step.legacyBehaviorRetainedUntilCommit !== true) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.FAILED_CONVERSION_MUTATES_LEGACY,
        policyId: step.policyId,
        message: 'Failed conversion must leave old active policy behavior intact.',
      });
    }
  });

  if (workflow.transactionalBoundary?.failedConversionLeavesLegacyActive !== true) {
    issues.push({
      riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.FAILED_CONVERSION_MUTATES_LEGACY,
      message: 'Workflow transaction boundary must retain legacy behavior on failed conversion.',
    });
  }

  Object.entries(workflow.sideEffects || {}).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Policy intent conversion workflow cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyIntentConversionWorkflowAudit(
  workflow = buildPolicyIntentConversionWorkflow()
) {
  const validation = validatePolicyIntentConversionWorkflow(workflow);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    readyToApplyCount: workflow.summary?.readyToApplyCount ?? 0,
    blockedCount: workflow.summary?.blockedCount ?? 0,
    validation,
    nextStep: workflow.nextStep || {
      stepId: 'native_runtime_read_path',
      label: 'Native Runtime Read Path',
      reason: 'Explicit conversion planning is defined; native runtime reads can now be introduced for converted policies.',
    },
  };
}

export {
  POLICY_INTENT_CONVERSION_ACTOR_SOURCE_IDS,
  POLICY_INTENT_CONVERSION_AUDIT_RISK_IDS,
  POLICY_INTENT_CONVERSION_REASON_IDS,
  POLICY_INTENT_CONVERSION_STEP_STATUS_IDS,
  POLICY_INTENT_CONVERSION_WORKFLOW_VERSION,
  buildPolicyIntentConversionWorkflow,
  buildPolicyIntentConversionWorkflowAudit,
  validatePolicyIntentConversionWorkflow,
};
