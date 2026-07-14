import {
  POLICY_CONVERSION_ACTOR_SOURCE_IDS,
} from './policyConversionActorSources.mjs';
import {
  POLICY_NATIVE_SCHEMA_TABLE_IDS,
} from './policyNativeSchemaContract.mjs';

const POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION = 'policy.rollback_snapshot_window.v1';

const POLICY_ROLLBACK_WINDOW_DEFAULT_DAYS = 14;
const POLICY_ROLLBACK_WINDOW_MIN_DAYS = 1;
const POLICY_ROLLBACK_WINDOW_MAX_DAYS = 30;

const POLICY_ROLLBACK_STATUS_IDS = Object.freeze({
  SNAPSHOT_READY: 'snapshot_ready',
  SNAPSHOT_BLOCKED: 'snapshot_blocked',
  REVERT_READY: 'revert_ready',
  REVERT_EXPIRED: 'revert_expired',
  RETENTION_CLEANUP_DUE: 'retention_cleanup_due',
});

const POLICY_ROLLBACK_REASON_IDS = Object.freeze({
  SNAPSHOT_REQUIRED: 'snapshot_required',
  REQUIRED_SECTIONS_INCLUDED: 'required_sections_included',
  ACTOR_AND_REASON_BOUND: 'actor_and_reason_bound',
  ROLLBACK_WINDOW_BOUNDED: 'rollback_window_bounded',
  REVERT_ALLOWED_DURING_WINDOW: 'revert_allowed_during_window',
  REVERT_BLOCKED_AFTER_EXPIRY: 'revert_blocked_after_expiry',
  BULKY_PAYLOAD_DELETE_AFTER_WINDOW: 'bulky_payload_delete_after_window',
  MINIMAL_AUDIT_METADATA_RETAINED: 'minimal_audit_metadata_retained',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const POLICY_ROLLBACK_PAYLOAD_SECTION_IDS = Object.freeze({
  PRESET_ATTACHMENTS: 'preset_attachments',
  WEIGHTS: 'weights',
  THRESHOLDS: 'thresholds',
  CUSTOM_SIGNALS: 'custom_signals',
  ROUTING_MAPPING_REFERENCES: 'routing_mapping_references',
  MIGRATION_ACTOR: 'migration_actor',
  MIGRATION_REASON: 'migration_reason',
});

const POLICY_ROLLBACK_POST_WINDOW_ACTION_IDS = Object.freeze({
  DELETE_BULKY_PAYLOAD_KEEP_AUDIT: 'delete_bulky_payload_keep_audit',
});

const POLICY_ROLLBACK_AUDIT_RISK_IDS = Object.freeze({
  MISSING_POLICY_ID: 'missing_policy_id',
  MISSING_INTENT_ID: 'missing_intent_id',
  MISSING_SNAPSHOT_SECTION: 'missing_snapshot_section',
  MISSING_RESTORE_PATH: 'missing_restore_path',
  MISSING_ACTOR_OR_REASON: 'missing_actor_or_reason',
  UNKNOWN_ACTOR_SOURCE: 'unknown_actor_source',
  UNBOUNDED_SNAPSHOT_WINDOW: 'unbounded_snapshot_window',
  SNAPSHOT_PERMANENT_ALTERNATE_STORAGE: 'snapshot_permanent_alternate_storage',
  RAW_PAYLOAD_EXPOSED: 'raw_payload_exposed',
  REVERT_AFTER_EXPIRY_ALLOWED: 'revert_after_expiry_allowed',
  ORDINARY_READ_WRITE_REVERT: 'ordinary_read_write_revert',
  MISSING_RETENTION_POLICY: 'missing_retention_policy',
  BULKY_PAYLOAD_RETAINED_AFTER_EXPIRY: 'bulky_payload_retained_after_expiry',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const REQUIRED_SNAPSHOT_SECTIONS = Object.freeze(
  Object.values(POLICY_ROLLBACK_PAYLOAD_SECTION_IDS)
);

const ALLOWED_ACTOR_SOURCE_IDS = Object.freeze([
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MANUAL_OPERATOR,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL,
]);

const BLOCKED_ACTOR_SOURCE_IDS = Object.freeze([
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.ORDINARY_POLICY_READ,
  POLICY_CONVERSION_ACTOR_SOURCE_IDS.UNRELATED_POLICY_SAVE,
]);

const MINIMAL_AUDIT_METADATA_FIELDS = Object.freeze([
  'policy_id',
  'intent_id',
  'snapshot_version',
  'created_at',
  'expires_at',
  'restored_at',
  'actor_source_id',
  'actor_id',
  'reason_code',
  'restore_path',
  'payload_digest',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toInteger(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function toIsoDate(value, fallback = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function addDays(isoDate, days) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function boundWindowDays(value) {
  const parsed = toInteger(value, POLICY_ROLLBACK_WINDOW_DEFAULT_DAYS);
  return Math.min(
    POLICY_ROLLBACK_WINDOW_MAX_DAYS,
    Math.max(POLICY_ROLLBACK_WINDOW_MIN_DAYS, parsed)
  );
}

function buildReason(reasonId, message, severity = 'info', details = {}) {
  return {
    reasonId,
    severity,
    message,
    ...details,
  };
}

function countObjectKeys(value) {
  return Object.keys(asObject(value)).length;
}

function summarizePresetAttachments(policy = {}) {
  const presets = asArray(policy.presets || policy.presetAttachments || policy.preset_attachments);

  return {
    included: true,
    count: presets.length,
    presetIds: presets.map(preset => preset.id ?? preset.preset_id ?? null)
      .filter(id => id !== null),
    presetKeys: presets.map(preset => preset.key ?? preset.preset_key ?? null)
      .filter(key => key !== null),
  };
}

function summarizeWeights(policy = {}) {
  const presets = asArray(policy.presets);

  return {
    included: true,
    policyWeight: policy.weight ?? policy.priority ?? null,
    presetWeights: presets.map(preset => ({
      presetId: preset.id ?? null,
      presetKey: preset.key ?? null,
      weight: preset.weight ?? null,
    })),
  };
}

function summarizeThresholds(policy = {}) {
  return {
    included: true,
    autoClassifyThreshold: policy.auto_classify_threshold ?? policy.autoClassifyThreshold ?? null,
    promptThreshold: policy.prompt_threshold ?? policy.promptThreshold ?? null,
    requireAiValidation: policy.require_ai_validation ?? policy.requireAiValidation ?? null,
    trustPatterns: policy.trust_patterns ?? policy.trustPatterns ?? null,
    trustRag: policy.trust_rag ?? policy.trustRag ?? null,
    trustHistory: policy.trust_history ?? policy.trustHistory ?? null,
    combinationMode: policy.combination_mode ?? policy.combinationMode ?? null,
  };
}

function summarizeCustomSignals(policy = {}) {
  const directSignals = asObject(policy.customSignals || policy.custom_signals);
  const presetSignals = asArray(policy.presets)
    .map(preset => asObject(preset.custom_signals || preset.customSignals))
    .filter(signalSet => countObjectKeys(signalSet) > 0);

  return {
    included: true,
    directSignalTypeCount: countObjectKeys(directSignals),
    presetSignalSetCount: presetSignals.length,
    signalTypes: Array.from(new Set([
      ...Object.keys(directSignals),
      ...presetSignals.flatMap(signalSet => Object.keys(signalSet)),
    ])).sort(),
    rawPayloadSuppressedFromReport: true,
  };
}

function summarizeRoutingReferences(policy = {}) {
  return {
    included: true,
    libraryId: policy.library_id ?? policy.libraryId ?? null,
    libraryName: policy.library_name ?? policy.libraryName ?? null,
    libraryMediaType: policy.library_media_type ?? policy.libraryMediaType ?? null,
    arrType: policy.arr_type ?? policy.arrType ?? null,
    arrConfigId: policy.arr_config_id ?? policy.arrConfigId ?? null,
    arrRootFolderId: policy.arr_root_folder_id ?? policy.arrRootFolderId ?? null,
    arrRootFolderPath: policy.arr_root_folder_path ?? policy.arrRootFolderPath ?? null,
  };
}

function summarizeActor(action = {}) {
  return {
    included: true,
    actorSourceId: action.actorSourceId ?? action.actor_source_id ?? null,
    actorIdPresent: Boolean(action.actorId ?? action.actor_id),
  };
}

function summarizeReason(action = {}) {
  return {
    included: true,
    reasonCode: action.reasonCode ?? action.reason_code ?? 'native_intent_conversion',
    reasonProvided: Boolean(action.reason),
  };
}

function buildSnapshotSections({ policy = {}, action = {} } = {}) {
  return [
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.PRESET_ATTACHMENTS,
      restoreRequired: true,
      reportRedacted: false,
      summary: summarizePresetAttachments(policy),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.WEIGHTS,
      restoreRequired: true,
      reportRedacted: false,
      summary: summarizeWeights(policy),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.THRESHOLDS,
      restoreRequired: true,
      reportRedacted: false,
      summary: summarizeThresholds(policy),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.CUSTOM_SIGNALS,
      restoreRequired: true,
      reportRedacted: true,
      summary: summarizeCustomSignals(policy),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.ROUTING_MAPPING_REFERENCES,
      restoreRequired: true,
      reportRedacted: false,
      summary: summarizeRoutingReferences(policy),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_ACTOR,
      restoreRequired: true,
      reportRedacted: true,
      summary: summarizeActor(action),
    },
    {
      sectionId: POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_REASON,
      restoreRequired: true,
      reportRedacted: true,
      summary: summarizeReason(action),
    },
  ];
}

function buildRestorePath(policyId, snapshotVersion) {
  return `policy/rollback/policies/${policyId}/v${snapshotVersion}`;
}

function isExpired(nowIso, expiresAt) {
  return new Date(nowIso).getTime() >= new Date(expiresAt).getTime();
}

function determineStatus({ actorAllowed, expired, retentionDue }) {
  if (!actorAllowed) return POLICY_ROLLBACK_STATUS_IDS.SNAPSHOT_BLOCKED;
  if (retentionDue) return POLICY_ROLLBACK_STATUS_IDS.RETENTION_CLEANUP_DUE;
  if (expired) return POLICY_ROLLBACK_STATUS_IDS.REVERT_EXPIRED;
  return POLICY_ROLLBACK_STATUS_IDS.REVERT_READY;
}

function buildPolicyRollbackSnapshotWindow({
  policy = {},
  action = {},
  targetVersion = 1,
  rollbackWindowDays = POLICY_ROLLBACK_WINDOW_DEFAULT_DAYS,
  now = new Date(),
  snapshot = {},
} = {}) {
  const nowIso = toIsoDate(now);
  const policyId = policy.id ?? policy.policy_id ?? snapshot.policyId ?? snapshot.policy_id ?? null;
  const intentId = policy.intent_id ?? policy.intentId ?? snapshot.intentId ?? snapshot.intent_id ?? null;
  const snapshotVersion = toInteger(targetVersion, 1);
  const boundedWindowDays = boundWindowDays(rollbackWindowDays);
  const expiresAt = snapshot.expiresAt || snapshot.expires_at || addDays(nowIso, boundedWindowDays);
  const expired = isExpired(nowIso, expiresAt);
  const actorSourceId = action.actorSourceId ?? action.actor_source_id ?? null;
  const actorAllowed = ALLOWED_ACTOR_SOURCE_IDS.includes(actorSourceId);
  const blockedOrdinaryActor = BLOCKED_ACTOR_SOURCE_IDS.includes(actorSourceId);
  const retentionDue = expired && snapshot.bulkPayloadDeleted !== true &&
    snapshot.bulk_payload_deleted !== true;
  const restorePath = snapshot.restorePath ||
    snapshot.restore_path ||
    buildRestorePath(policyId ?? 'unassigned', snapshotVersion);
  const payloadSections = buildSnapshotSections({ policy, action });
  const statusId = determineStatus({ actorAllowed, expired, retentionDue });
  const reasons = [
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.SNAPSHOT_REQUIRED,
      'Conversion or accepted rebuild requires a rollback snapshot before native intent becomes active.'
    ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.REQUIRED_SECTIONS_INCLUDED,
      'Rollback snapshot manifest includes preset attachments, weights, thresholds, custom signals, routing references, actor, and reason.'
    ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.ACTOR_AND_REASON_BOUND,
      'Rollback snapshot binds the actor source and migration reason to the restore manifest.'
    ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.ROLLBACK_WINDOW_BOUNDED,
      'Rollback window is bounded and cannot become permanent alternate policy storage.',
      'info',
      { rollbackWindowDays: boundedWindowDays }
    ),
    expired
      ? buildReason(
        POLICY_ROLLBACK_REASON_IDS.REVERT_BLOCKED_AFTER_EXPIRY,
        'Revert is blocked after the rollback window expires.',
        'blocker'
      )
      : buildReason(
        POLICY_ROLLBACK_REASON_IDS.REVERT_ALLOWED_DURING_WINDOW,
        'Revert path is eligible during the rollback window for approved actor sources.'
      ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.BULKY_PAYLOAD_DELETE_AFTER_WINDOW,
      'Retention cleanup deletes bulky legacy snapshot payload after expiry.'
    ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.MINIMAL_AUDIT_METADATA_RETAINED,
      'Post-window retention keeps only bounded audit metadata needed for support and compliance.'
    ),
    buildReason(
      POLICY_ROLLBACK_REASON_IDS.SIDE_EFFECTS_DISABLED,
      'This rollback snapshot window contract plans rollback behavior but performs no writes, deletes, or restores.'
    ),
  ];

  const windowPlan = {
    version: POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION,
    statusId,
    policyId,
    intentId,
    evaluatedAt: nowIso,
    snapshot: {
      planned: actorAllowed,
      tableId: POLICY_NATIVE_SCHEMA_TABLE_IDS.POLICY_INTENT_ROLLBACK_SNAPSHOTS,
      policyId,
      intentId,
      snapshotVersion,
      restorePath,
      createdAt: nowIso,
      expiresAt,
      rollbackWindowDays: boundedWindowDays,
      payloadRedactedForReports: true,
      rawPayloadExposed: false,
      restorePayloadRequired: true,
      permanentAlternateStorage: false,
      payloadSections,
    },
    revert: {
      eligible: actorAllowed && !expired,
      blockedReason: !actorAllowed
        ? 'actor_source_not_allowed'
        : expired
          ? 'rollback_window_expired'
          : null,
      blockedOrdinaryActor,
      allowedActorSourceIds: [...ALLOWED_ACTOR_SOURCE_IDS],
      restorePath,
      idempotencyKey: `policy:rollback:${policyId}:v${snapshotVersion}`,
    },
    retention: {
      windowDays: boundedWindowDays,
      expiresAt,
      postWindowActionId: POLICY_ROLLBACK_POST_WINDOW_ACTION_IDS.DELETE_BULKY_PAYLOAD_KEEP_AUDIT,
      deleteBulkyPayloadAfterExpiry: true,
      retainBulkPayloadAfterExpiry: false,
      minimalAuditMetadataFields: [...MINIMAL_AUDIT_METADATA_FIELDS],
      retentionDue,
    },
    sideEffects: {
      rollbackSnapshotWritten: false,
      policyRestored: false,
      bulkPayloadDeleted: false,
      migrationEventWritten: false,
      legacyRowsChanged: false,
    },
    reasons,
    nextStep: {
      stepId: 'legacy_write_path_shutdown',
      label: 'Legacy Write Path Shutdown',
      reason: 'Rollback window behavior is defined, so converted policies can next block legacy write drift.',
    },
  };

  return {
    ...windowPlan,
    validation: validatePolicyRollbackSnapshotWindow(windowPlan),
  };
}

function validatePolicyRollbackSnapshotWindow(windowPlan = {}) {
  const issues = [];
  const snapshot = asObject(windowPlan.snapshot);
  const revert = asObject(windowPlan.revert);
  const retention = asObject(windowPlan.retention);
  const sideEffects = asObject(windowPlan.sideEffects);
  const reasons = asArray(windowPlan.reasons);
  const sectionIds = asArray(snapshot.payloadSections).map(section => section.sectionId);
  const actorSection = asArray(snapshot.payloadSections)
    .find(section => section.sectionId === POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_ACTOR);
  const reasonSection = asArray(snapshot.payloadSections)
    .find(section => section.sectionId === POLICY_ROLLBACK_PAYLOAD_SECTION_IDS.MIGRATION_REASON);

  if (windowPlan.policyId === null || windowPlan.policyId === undefined) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_POLICY_ID,
      message: 'Rollback snapshot window must identify the policy being converted or reverted.',
    });
  }

  if (windowPlan.intentId === null || windowPlan.intentId === undefined) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_INTENT_ID,
      message: 'Rollback snapshot window must bind to the native intent id or planned intent id.',
    });
  }

  REQUIRED_SNAPSHOT_SECTIONS.forEach(sectionId => {
    if (!sectionIds.includes(sectionId)) {
      issues.push({
        riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_SNAPSHOT_SECTION,
        sectionId,
        message: 'Rollback snapshot is missing a required restore section.',
      });
    }
  });

  if (!normalizeString(snapshot.restorePath)) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_RESTORE_PATH,
      message: 'Rollback snapshot must include a restore path.',
    });
  }

  if (!normalizeString(actorSection?.summary?.actorSourceId) ||
      !normalizeString(reasonSection?.summary?.reasonCode)) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_ACTOR_OR_REASON,
      message: 'Rollback snapshots must bind actor source and migration reason.',
    });
  }

  if (normalizeString(actorSection?.summary?.actorSourceId) &&
      !ALLOWED_ACTOR_SOURCE_IDS.includes(actorSection.summary.actorSourceId)) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.UNKNOWN_ACTOR_SOURCE,
      actorSourceId: actorSection.summary.actorSourceId,
      message: 'Rollback snapshot actor source must be an approved migration action source.',
    });
  }

  if (!normalizeString(snapshot.expiresAt) ||
      !Number.isFinite(Number(retention.windowDays)) ||
      Number(retention.windowDays) < POLICY_ROLLBACK_WINDOW_MIN_DAYS ||
      Number(retention.windowDays) > POLICY_ROLLBACK_WINDOW_MAX_DAYS) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.UNBOUNDED_SNAPSHOT_WINDOW,
      message: 'Rollback snapshot window must be bounded between one and thirty days.',
    });
  }

  if (snapshot.permanentAlternateStorage === true) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.SNAPSHOT_PERMANENT_ALTERNATE_STORAGE,
      message: 'Rollback snapshots must not become permanent alternate legacy policy storage.',
    });
  }

  if (snapshot.rawPayloadExposed === true || snapshot.payloadRedactedForReports !== true) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      message: 'Rollback reports must not expose raw legacy payloads.',
    });
  }

  const evaluatedAt = windowPlan.evaluatedAt || snapshot.createdAt || new Date().toISOString();
  if (revert.eligible === true &&
      new Date(snapshot.expiresAt).getTime() < new Date(evaluatedAt).getTime()) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.REVERT_AFTER_EXPIRY_ALLOWED,
      message: 'Rollback revert must not be eligible after snapshot expiry.',
    });
  }

  if (revert.blockedOrdinaryActor === true && revert.eligible === true) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.ORDINARY_READ_WRITE_REVERT,
      message: 'Ordinary policy reads and unrelated saves cannot trigger revert.',
    });
  }

  if (!normalizeString(retention.postWindowActionId) ||
      retention.deleteBulkyPayloadAfterExpiry !== true ||
      asArray(retention.minimalAuditMetadataFields).length === 0) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_RETENTION_POLICY,
      message: 'Rollback window must define post-window deletion and minimal audit retention.',
    });
  }

  if (retention.retainBulkPayloadAfterExpiry === true) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.BULKY_PAYLOAD_RETAINED_AFTER_EXPIRY,
      message: 'Bulky legacy snapshot payload cannot be retained after rollback expiry.',
    });
  }

  if (Object.values(sideEffects).some(value => value === true)) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Policy rollback snapshot window planning must not perform writes, deletes, or restores.',
    });
  }

  if (reasons.length === 0) {
    issues.push({
      riskId: POLICY_ROLLBACK_AUDIT_RISK_IDS.MISSING_REASON,
      message: 'Rollback snapshot window output must include bounded reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyRollbackSnapshotWindowAudit(windowPlan = {}) {
  const validation = windowPlan.validation ||
    validatePolicyRollbackSnapshotWindow(windowPlan);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    statusId: windowPlan.statusId || null,
    policyId: windowPlan.policyId ?? null,
    intentId: windowPlan.intentId ?? null,
    snapshotSectionCount: asArray(windowPlan.snapshot?.payloadSections).length,
    rollbackWindowDays: windowPlan.retention?.windowDays ?? null,
    revertEligible: windowPlan.revert?.eligible === true,
    retentionDue: windowPlan.retention?.retentionDue === true,
    issueIds: asArray(validation.issues).map(issue => issue.riskId),
    nextStep: windowPlan.nextStep || null,
  };
}

export {
  POLICY_ROLLBACK_AUDIT_RISK_IDS,
  POLICY_ROLLBACK_PAYLOAD_SECTION_IDS,
  POLICY_ROLLBACK_POST_WINDOW_ACTION_IDS,
  POLICY_ROLLBACK_REASON_IDS,
  POLICY_ROLLBACK_SNAPSHOT_WINDOW_VERSION,
  POLICY_ROLLBACK_STATUS_IDS,
  buildPolicyRollbackSnapshotWindow,
  buildPolicyRollbackSnapshotWindowAudit,
  validatePolicyRollbackSnapshotWindow,
};
