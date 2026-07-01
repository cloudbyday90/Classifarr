const PHASE8R_LEGACY_WRITE_SHUTDOWN_VERSION = 'phase8r.legacy_write_path_shutdown.v1';

const PHASE8R_LEGACY_WRITE_OPERATION_IDS = Object.freeze({
  CREATE_POLICY: 'create_policy',
  UPDATE_POLICY: 'update_policy',
  RESET_POLICY: 'reset_policy',
  DELETE_POLICY: 'delete_policy',
  ATTACH_PRESET: 'attach_preset',
  DETACH_PRESET: 'detach_preset',
  REPLACE_PRESETS: 'replace_presets',
  UPDATE_PRESET_CUSTOM_SIGNALS: 'update_preset_custom_signals',
  NATIVE_INTENT_WRITE: 'native_intent_write',
});

const PHASE8R_LEGACY_WRITE_STATUS_IDS = Object.freeze({
  CONVERTED_LEGACY_WRITE_BLOCKED: 'converted_legacy_write_blocked',
  CONVERTED_METADATA_WRITE_ALLOWED: 'converted_metadata_write_allowed',
  UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED: 'unconverted_compatibility_write_allowed',
  NATIVE_WRITE_PATH_REQUIRED: 'native_write_path_required',
  NATIVE_WRITE_ALLOWED: 'native_write_allowed',
  NEW_POLICY_LEGACY_DEFAULT_ALLOWED: 'new_policy_legacy_default_allowed',
  NEW_POLICY_NATIVE_DEFAULT_REQUIRED: 'new_policy_native_default_required',
});

const PHASE8R_LEGACY_WRITE_REASON_IDS = Object.freeze({
  CONVERTED_POLICY_DETECTED: 'converted_policy_detected',
  LEGACY_BEHAVIOR_WRITE_DETECTED: 'legacy_behavior_write_detected',
  LEGACY_WRITE_BLOCKED_FOR_CONVERTED_POLICY: 'legacy_write_blocked_for_converted_policy',
  METADATA_ONLY_WRITE_ALLOWED: 'metadata_only_write_allowed',
  COMPATIBILITY_WRITE_RETAINED_FOR_UNCONVERTED_POLICY: 'compatibility_write_retained_for_unconverted_policy',
  NATIVE_WRITE_PATH_NOT_READY: 'native_write_path_not_ready',
  NATIVE_WRITE_PATH_READY: 'native_write_path_ready',
  NEW_POLICY_NATIVE_DEFAULT_NOT_READY: 'new_policy_native_default_not_ready',
  NEW_POLICY_NATIVE_DEFAULT_READY: 'new_policy_native_default_ready',
  LEGACY_REMOVAL_CHECKLIST_ATTACHED: 'legacy_removal_checklist_attached',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const PHASE8R_LEGACY_WRITE_RISK_IDS = Object.freeze({
  CONVERTED_LEGACY_WRITE_ALLOWED: 'converted_legacy_write_allowed',
  CONVERTED_RESET_TO_LEGACY_ALLOWED: 'converted_reset_to_legacy_allowed',
  NATIVE_WRITE_ALLOWED_WITHOUT_READY_PATH: 'native_write_allowed_without_ready_path',
  UNCONVERTED_COMPATIBILITY_WRITE_WITHOUT_WARNING: 'unconverted_compatibility_write_without_warning',
  NEW_POLICY_LEGACY_DEFAULT_WITH_NATIVE_READY: 'new_policy_legacy_default_with_native_ready',
  MISSING_REMOVAL_CHECKLIST: 'missing_removal_checklist',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
  UNKNOWN_OPERATION: 'unknown_operation',
});

const PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS = Object.freeze({
  PRESET_ATTACHMENTS: 'preset_attachments',
  PRESET_CUSTOM_SIGNALS: 'preset_custom_signals',
  LEGACY_SCORING_WEIGHTS: 'legacy_scoring_weights',
  LEGACY_TRUST_FLAGS: 'legacy_trust_flags',
  LEGACY_DECISION_THRESHOLDS: 'legacy_decision_thresholds',
  LEGACY_COMBINATION_MODE: 'legacy_combination_mode',
  NATIVE_INTENT: 'native_intent',
  METADATA: 'metadata',
});

const VALID_OPERATION_IDS = Object.freeze(Object.values(PHASE8R_LEGACY_WRITE_OPERATION_IDS));

const LEGACY_BEHAVIOR_FIELD_DEFINITIONS = Object.freeze([
  {
    field: 'presets',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_ATTACHMENTS,
  },
  {
    field: 'preset_id',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_ATTACHMENTS,
  },
  {
    field: 'presetId',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_ATTACHMENTS,
  },
  {
    field: 'customSignals',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_CUSTOM_SIGNALS,
  },
  {
    field: 'custom_signals',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_CUSTOM_SIGNALS,
  },
  {
    field: 'legacyCustomSignals',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_CUSTOM_SIGNALS,
  },
  {
    field: 'preset_weight',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_SCORING_WEIGHTS,
  },
  {
    field: 'profile_weight',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_SCORING_WEIGHTS,
  },
  {
    field: 'pattern_weight',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_SCORING_WEIGHTS,
  },
  {
    field: 'rag_weight',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_SCORING_WEIGHTS,
  },
  {
    field: 'history_weight',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_SCORING_WEIGHTS,
  },
  {
    field: 'trust_patterns',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_TRUST_FLAGS,
  },
  {
    field: 'trust_rag',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_TRUST_FLAGS,
  },
  {
    field: 'trust_history',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_TRUST_FLAGS,
  },
  {
    field: 'auto_classify_threshold',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_DECISION_THRESHOLDS,
  },
  {
    field: 'prompt_threshold',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_DECISION_THRESHOLDS,
  },
  {
    field: 'require_ai_validation',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_DECISION_THRESHOLDS,
  },
  {
    field: 'combination_mode',
    groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.LEGACY_COMBINATION_MODE,
  },
]);

const NATIVE_INTENT_FIELD_NAMES = Object.freeze([
  'nativeIntent',
  'native_intent',
  'nativeIntentContract',
  'native_intent_contract',
  'policy_intent_contract',
  'intentContract',
]);

const METADATA_FIELD_NAMES = Object.freeze([
  'name',
  'description',
  'enabled',
  'priority',
  'sort_order',
  'library_id',
]);

const REQUIRED_REMOVAL_CHECKLIST_ITEMS = Object.freeze([
  'guard_policy_update_route_for_converted_policies',
  'guard_policy_preset_attach_route_for_converted_policies',
  'guard_policy_preset_delete_route_for_converted_policies',
  'guard_policy_reset_route_for_converted_policies',
  'guard_auto_learning_custom_signal_writers_for_converted_policies',
  'route_native_intent_writes_to_native_storage',
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(value = {}, field) {
  return Object.prototype.hasOwnProperty.call(asObject(value), field);
}

function buildReason(reasonId, message, severity = 'info', details = {}) {
  return {
    reasonId,
    severity,
    message,
    ...details,
  };
}

function detectConvertedPolicy(policy = {}) {
  const nativeIntent = asObject(policy.nativeIntent || policy.native_intent);
  const nativeContract = asObject(
    policy.policy_intent_contract ||
    policy.nativeIntentContract ||
    policy.native_intent_contract ||
    nativeIntent.contract
  );

  return policy.native_intent_active === true ||
    policy.nativeIntentActive === true ||
    nativeIntent.active === true ||
    nativeIntent.is_active === true ||
    nativeContract.source === 'native_intent' ||
    nativeContract.model?.native_intent === true;
}

function detectLegacyBehaviorFields(payload = {}, operationId) {
  const fields = [];

  LEGACY_BEHAVIOR_FIELD_DEFINITIONS.forEach(definition => {
    if (hasOwn(payload, definition.field)) {
      fields.push({
        field: definition.field,
        groupId: definition.groupId,
      });
    }
  });

  if (
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.ATTACH_PRESET ||
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.DETACH_PRESET ||
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.REPLACE_PRESETS ||
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.UPDATE_PRESET_CUSTOM_SIGNALS
  ) {
    fields.push({
      field: operationId,
      groupId: operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.UPDATE_PRESET_CUSTOM_SIGNALS
        ? PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_CUSTOM_SIGNALS
        : PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_ATTACHMENTS,
    });
  }

  if (Array.isArray(payload.presets)) {
    payload.presets.forEach((preset, index) => {
      if (hasOwn(preset, 'customSignals') || hasOwn(preset, 'custom_signals')) {
        fields.push({
          field: `presets[${index}].customSignals`,
          groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.PRESET_CUSTOM_SIGNALS,
        });
      }
    });
  }

  return fields;
}

function detectNativeIntentFields(payload = {}) {
  return NATIVE_INTENT_FIELD_NAMES
    .filter(field => hasOwn(payload, field))
    .map(field => ({
      field,
      groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.NATIVE_INTENT,
    }));
}

function detectMetadataFields(payload = {}) {
  return METADATA_FIELD_NAMES
    .filter(field => hasOwn(payload, field))
    .map(field => ({
      field,
      groupId: PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS.METADATA,
    }));
}

function buildRemovalChecklist() {
  return REQUIRED_REMOVAL_CHECKLIST_ITEMS.map(itemId => ({
    itemId,
    required: true,
  }));
}

function determineBoundaryStatus({
  converted,
  isCreate,
  operationId,
  legacyWriteDetected,
  nativeWriteDetected,
  metadataWriteDetected,
  nativeWriteReady,
  nativeDefaultReady,
}) {
  if (isCreate && legacyWriteDetected && nativeDefaultReady) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_NATIVE_DEFAULT_REQUIRED;
  }

  if (isCreate && legacyWriteDetected) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_LEGACY_DEFAULT_ALLOWED;
  }

  if (converted && operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.RESET_POLICY) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.CONVERTED_LEGACY_WRITE_BLOCKED;
  }

  if (converted && legacyWriteDetected) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.CONVERTED_LEGACY_WRITE_BLOCKED;
  }

  if (converted && nativeWriteDetected && nativeWriteReady !== true) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.NATIVE_WRITE_PATH_REQUIRED;
  }

  if (converted && nativeWriteDetected && nativeWriteReady === true) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.NATIVE_WRITE_ALLOWED;
  }

  if (converted && metadataWriteDetected) {
    return PHASE8R_LEGACY_WRITE_STATUS_IDS.CONVERTED_METADATA_WRITE_ALLOWED;
  }

  return PHASE8R_LEGACY_WRITE_STATUS_IDS.UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED;
}

function isWriteAllowed(statusId) {
  return [
    PHASE8R_LEGACY_WRITE_STATUS_IDS.CONVERTED_METADATA_WRITE_ALLOWED,
    PHASE8R_LEGACY_WRITE_STATUS_IDS.UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED,
    PHASE8R_LEGACY_WRITE_STATUS_IDS.NATIVE_WRITE_ALLOWED,
    PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_LEGACY_DEFAULT_ALLOWED,
  ].includes(statusId);
}

function buildPolicyBuilderPhase8LegacyWritePathShutdown({
  policy = {},
  payload = {},
  operationId = PHASE8R_LEGACY_WRITE_OPERATION_IDS.UPDATE_POLICY,
  nativeWriteReady = false,
  nativeDefaultReady = false,
} = {}) {
  const converted = detectConvertedPolicy(policy);
  const isCreate = operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.CREATE_POLICY ||
    !policy.id && !policy.policy_id;
  const legacyFields = detectLegacyBehaviorFields(payload, operationId);
  const nativeFields = detectNativeIntentFields(payload);
  const metadataFields = detectMetadataFields(payload);
  const legacyWriteDetected = legacyFields.length > 0 ||
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.RESET_POLICY;
  const nativeWriteDetected = nativeFields.length > 0 ||
    operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.NATIVE_INTENT_WRITE;
  const metadataWriteDetected = metadataFields.length > 0 &&
    legacyWriteDetected === false &&
    nativeWriteDetected === false;
  const statusId = determineBoundaryStatus({
    converted,
    isCreate,
    operationId,
    legacyWriteDetected,
    nativeWriteDetected,
    metadataWriteDetected,
    nativeWriteReady,
    nativeDefaultReady,
  });
  const allowed = isWriteAllowed(statusId);
  const warnings = [];
  const migrationBlockers = [];

  if (
    statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED ||
    statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_LEGACY_DEFAULT_ALLOWED
  ) {
    warnings.push({
      warningId: 'compatibility_write_time_bounded',
      message: 'Legacy preset/custom-signal writes are compatibility-only until native intent writes become authoritative.',
    });
  }

  if (!allowed) {
    migrationBlockers.push({
      blockerId: statusId,
      message: 'Write must use native intent storage or wait for native write readiness instead of mutating legacy behavior fields.',
    });
  }

  const reasons = [
    converted
      ? buildReason(
        PHASE8R_LEGACY_WRITE_REASON_IDS.CONVERTED_POLICY_DETECTED,
        'Policy has active native intent and must not accept legacy behavior writes.'
      )
      : buildReason(
        PHASE8R_LEGACY_WRITE_REASON_IDS.COMPATIBILITY_WRITE_RETAINED_FOR_UNCONVERTED_POLICY,
        'Policy is unconverted or new, so compatibility writes remain time-bounded.',
        'info'
      ),
    legacyWriteDetected
      ? buildReason(
        PHASE8R_LEGACY_WRITE_REASON_IDS.LEGACY_BEHAVIOR_WRITE_DETECTED,
        'Payload or operation targets legacy preset/custom-signal behavior.',
        converted ? 'blocker' : 'warning',
        { legacyFieldCount: legacyFields.length }
      )
      : buildReason(
        PHASE8R_LEGACY_WRITE_REASON_IDS.METADATA_ONLY_WRITE_ALLOWED,
        'Payload does not change legacy policy behavior fields.'
      ),
  ];

  if (statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.CONVERTED_LEGACY_WRITE_BLOCKED) {
    reasons.push(buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.LEGACY_WRITE_BLOCKED_FOR_CONVERTED_POLICY,
      'Converted policies cannot drift back to legacy preset/custom-signal storage.',
      'blocker'
    ));
  }

  if (nativeWriteDetected && nativeWriteReady !== true) {
    reasons.push(buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.NATIVE_WRITE_PATH_NOT_READY,
      'Native intent write payload was detected, but native write persistence is not marked ready.',
      'blocker'
    ));
  } else if (nativeWriteDetected) {
    reasons.push(buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.NATIVE_WRITE_PATH_READY,
      'Native intent write payload can use native storage.',
      'info'
    ));
  }

  if (isCreate && nativeDefaultReady === true) {
    reasons.push(buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.NEW_POLICY_NATIVE_DEFAULT_READY,
      'New policy creation should default to native intent because conversion gates and rollback tools are ready.',
      statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_NATIVE_DEFAULT_REQUIRED ? 'blocker' : 'info'
    ));
  } else if (isCreate) {
    reasons.push(buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.NEW_POLICY_NATIVE_DEFAULT_NOT_READY,
      'New policy creation can continue compatibility mode until native default gates pass.',
      'warning'
    ));
  }

  reasons.push(
    buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.LEGACY_REMOVAL_CHECKLIST_ATTACHED,
      'Legacy write shutdown includes route and writer removal checklist items.'
    ),
    buildReason(
      PHASE8R_LEGACY_WRITE_REASON_IDS.SIDE_EFFECTS_DISABLED,
      'Phase 8R.6 write shutdown contract performs no route writes, native inserts, or legacy deletes.'
    )
  );

  const boundary = {
    version: PHASE8R_LEGACY_WRITE_SHUTDOWN_VERSION,
    operationId,
    statusId,
    allowed,
    convertedPolicy: converted,
    nativeWriteReady: nativeWriteReady === true,
    nativeDefaultReady: nativeDefaultReady === true,
    detectedFields: {
      legacyBehavior: legacyFields,
      nativeIntent: nativeFields,
      metadata: metadataFields,
    },
    warnings,
    migrationBlockers,
    removalChecklist: buildRemovalChecklist(),
    sideEffects: {
      routeWritePerformed: false,
      nativeRowsWritten: false,
      legacyRowsWritten: false,
      legacyRowsDeleted: false,
      draftSidecarPersisted: false,
    },
    reasons,
    nextPhase: {
      phaseId: '8r_7',
      label: 'Legacy Code Deletion Gates',
      reason: 'Converted policies have a legacy write shutdown contract, so replaced compatibility code can next receive deletion gates.',
    },
  };

  return {
    ...boundary,
    validation: validatePolicyBuilderPhase8LegacyWritePathShutdown(boundary),
  };
}

function validatePolicyBuilderPhase8LegacyWritePathShutdown(boundary = {}) {
  const issues = [];
  const reasons = asArray(boundary.reasons);
  const legacyFields = asArray(boundary.detectedFields?.legacyBehavior);
  const nativeFields = asArray(boundary.detectedFields?.nativeIntent);
  const sideEffects = asObject(boundary.sideEffects);
  const checklistIds = asArray(boundary.removalChecklist).map(item => item.itemId);

  if (!VALID_OPERATION_IDS.includes(boundary.operationId)) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.UNKNOWN_OPERATION,
      operationId: boundary.operationId || null,
      message: 'Legacy write shutdown must classify a known policy write operation.',
    });
  }

  if (
    boundary.convertedPolicy === true &&
    legacyFields.length > 0 &&
    boundary.allowed === true
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.CONVERTED_LEGACY_WRITE_ALLOWED,
      message: 'Converted policies must not allow legacy preset/custom-signal behavior writes.',
    });
  }

  if (
    boundary.convertedPolicy === true &&
    boundary.operationId === PHASE8R_LEGACY_WRITE_OPERATION_IDS.RESET_POLICY &&
    boundary.allowed === true
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.CONVERTED_RESET_TO_LEGACY_ALLOWED,
      message: 'Converted policy reset must not recreate legacy-only policy behavior.',
    });
  }

  if (
    nativeFields.length > 0 &&
    boundary.allowed === true &&
    boundary.nativeWriteReady !== true
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.NATIVE_WRITE_ALLOWED_WITHOUT_READY_PATH,
      message: 'Native intent writes cannot be allowed until native write persistence is ready.',
    });
  }

  if (
    boundary.statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.UNCONVERTED_COMPATIBILITY_WRITE_ALLOWED &&
    asArray(boundary.warnings).length === 0
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.UNCONVERTED_COMPATIBILITY_WRITE_WITHOUT_WARNING,
      message: 'Unconverted compatibility writes must remain visibly time-bounded.',
    });
  }

  if (
    boundary.statusId === PHASE8R_LEGACY_WRITE_STATUS_IDS.NEW_POLICY_NATIVE_DEFAULT_REQUIRED &&
    boundary.allowed === true
  ) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.NEW_POLICY_LEGACY_DEFAULT_WITH_NATIVE_READY,
      message: 'New policy legacy defaults cannot remain allowed once native default gates are ready.',
    });
  }

  REQUIRED_REMOVAL_CHECKLIST_ITEMS.forEach(itemId => {
    if (!checklistIds.includes(itemId)) {
      issues.push({
        riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.MISSING_REMOVAL_CHECKLIST,
        itemId,
        message: 'Legacy write shutdown must carry the route/writer removal checklist.',
      });
    }
  });

  if (Object.values(sideEffects).some(value => value === true)) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.SIDE_EFFECT_PERFORMED,
      message: 'Phase 8R.6 write shutdown planning must not perform route writes, inserts, or deletes.',
    });
  }

  if (reasons.length === 0) {
    issues.push({
      riskId: PHASE8R_LEGACY_WRITE_RISK_IDS.MISSING_REASON,
      message: 'Legacy write shutdown output must include bounded reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase8LegacyWritePathShutdownAudit(
  boundary = buildPolicyBuilderPhase8LegacyWritePathShutdown()
) {
  const validation = boundary.validation ||
    validatePolicyBuilderPhase8LegacyWritePathShutdown(boundary);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    operationId: boundary.operationId || null,
    statusId: boundary.statusId || null,
    allowed: boundary.allowed === true,
    convertedPolicy: boundary.convertedPolicy === true,
    legacyFieldCount: asArray(boundary.detectedFields?.legacyBehavior).length,
    nativeFieldCount: asArray(boundary.detectedFields?.nativeIntent).length,
    warningCount: asArray(boundary.warnings).length,
    migrationBlockerCount: asArray(boundary.migrationBlockers).length,
    removalChecklistCount: asArray(boundary.removalChecklist).length,
    issueIds: asArray(validation.issues).map(issue => issue.riskId),
    nextPhase: boundary.nextPhase || null,
  };
}

export {
  PHASE8R_LEGACY_WRITE_FIELD_GROUP_IDS,
  PHASE8R_LEGACY_WRITE_OPERATION_IDS,
  PHASE8R_LEGACY_WRITE_REASON_IDS,
  PHASE8R_LEGACY_WRITE_RISK_IDS,
  PHASE8R_LEGACY_WRITE_SHUTDOWN_VERSION,
  PHASE8R_LEGACY_WRITE_STATUS_IDS,
  buildPolicyBuilderPhase8LegacyWritePathShutdown,
  buildPolicyBuilderPhase8LegacyWritePathShutdownAudit,
  validatePolicyBuilderPhase8LegacyWritePathShutdown,
};
