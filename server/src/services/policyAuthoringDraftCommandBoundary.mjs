import {
  DRAFT_COMMAND_IDS,
  isDraftCommandAllowed,
} from './policyBuilderDraftStateBoundary.mjs';
import {
  POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  canPolicyAuthoringBridgeSerializeKey,
} from './policyAuthoringBridgeSerializer.mjs';
import {
  POLICY_AUTHORING_DRAFT_FIELD_IDS,
} from './policyAuthoringDraftFieldContract.mjs';

const POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS = Object.freeze({
  OPERATOR_EDIT: 'operator_edit',
  BRIDGE_SYSTEM: 'bridge_system',
  LEGACY_COMPATIBILITY_ADAPTER: 'legacy_compatibility_adapter',
  FUTURE_OPERATOR_EDIT: 'future_operator_edit',
});

const POLICY_AUTHORING_DRAFT_COMMAND_IDS = Object.freeze({
  ...DRAFT_COMMAND_IDS,
  SET_ROUTING_TARGET: 'set_routing_target',
  ACKNOWLEDGE_WARNING: 'acknowledge_warning',
});

const POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS = Object.freeze({
  UNKNOWN_COMMAND: 'unknown_command',
  INVALID_PAYLOAD: 'invalid_payload',
  LEGACY_STORAGE_TERM_LEAK: 'legacy_storage_term_leak',
  ARBITRARY_COMPATIBILITY_FIELD: 'arbitrary_compatibility_field',
  READ_ONLY_PROJECTION_MUTATION: 'read_only_projection_mutation',
  ROUTING_SIDE_EFFECT: 'routing_side_effect',
  NOT_IMPLEMENTED: 'not_implemented',
});

const POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_COMMAND: 'unknown_command',
  UNKNOWN_CATEGORY: 'unknown_category',
  UNKNOWN_PAYLOAD_AUTHORITY: 'unknown_payload_authority',
  IMPLEMENTED_COMMAND_NOT_ALLOWLISTED: 'implemented_command_not_allowlisted',
  FUTURE_COMMAND_HAS_IMPLEMENTATION: 'future_command_has_implementation',
  OPERATOR_COMMAND_NOT_PRODUCT_INTENT: 'operator_command_not_product_intent',
  BRIDGE_COMMAND_OPERATOR_FACING: 'bridge_command_operator_facing',
  COMPATIBILITY_ADAPTER_OPERATOR_FACING: 'compatibility_adapter_operator_facing',
  BATCH_VALUES_WITHOUT_PRODUCT_INTENT: 'batch_values_without_product_intent',
  COMPATIBILITY_SERIALIZATION_WITHOUT_ALLOWLIST: 'compatibility_serialization_without_allowlist',
  READ_ONLY_PROJECTION_MUTATION_ALLOWED: 'read_only_projection_mutation_allowed',
  RAW_LEGACY_TERM_IN_OPERATOR_COMMAND: 'raw_legacy_term_in_operator_command',
  MISSING_PRODUCT_COMMAND_TARGET: 'missing_product_command_target',
});

const POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS = Object.freeze({
  PRODUCT_INTENT: 'product_intent',
  BRIDGE_COMPATIBILITY: 'bridge_compatibility',
  READ_ONLY_PROJECTION: 'read_only_projection',
  UI_ONLY: 'ui_only',
});

const POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS = Object.freeze({
  CONFIGURE_SIGNAL: 'configure_signal',
  CONFIGURE_CONSTRAINT_BEHAVIOR: 'configure_constraint_behavior',
  IGNORE_TEMPLATE_SIGNAL: 'ignore_template_signal',
});

const READ_ONLY_DRAFT_FIELD_IDS = Object.freeze([
  POLICY_AUTHORING_DRAFT_FIELD_IDS.EVIDENCE_PROJECTION,
  POLICY_AUTHORING_DRAFT_FIELD_IDS.READINESS_PROJECTION,
]);

const READ_ONLY_PAYLOAD_KEYS = Object.freeze([
  'evidenceProjection',
  'evidence_projection',
  'readinessProjection',
  'readiness_projection',
  'libraryProfile',
  'libraryProfileFreshness',
  'impactPreview',
  'replayPreview',
]);

const RAW_LEGACY_PAYLOAD_KEYS = Object.freeze([
  'customSignals',
  'custom_signals',
  'legacyCustomSignals',
  'legacy_custom_signals',
  'rawCustomSignals',
  'raw_custom_signals',
]);

const ROUTING_SIDE_EFFECT_KEYS = Object.freeze([
  'arrWrite',
  'arr_write',
  'executeRouting',
  'execute_routing',
  'routeNow',
  'route_now',
  'routingSideEffect',
  'routing_side_effect',
]);

const RAW_LEGACY_COMMAND_TERM_PATTERNS = Object.freeze([
  /customSignals/i,
  /custom_signals/i,
  /legacy payload/i,
  /raw legacy/i,
  /preset_id/i,
  /presetId/i,
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  Object.values(value).forEach(item => {
    deepFreeze(item);
  });

  return value;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(asObject(value), key);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyScalarOrArray(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(item => (
      isNonEmptyString(item) || typeof item === 'number' || typeof item === 'boolean'
    ));
  }

  return isNonEmptyString(value) || typeof value === 'number' || typeof value === 'boolean';
}

function collectMatchingKeys(payload, keys) {
  const value = asObject(payload);
  return keys.filter(key => hasOwn(value, key));
}

function collectReadOnlyProjectionKeys(payload) {
  const directKeys = collectMatchingKeys(payload, READ_ONLY_PAYLOAD_KEYS);
  const fieldId = asObject(payload).fieldId;
  const fieldKeys = READ_ONLY_DRAFT_FIELD_IDS.includes(fieldId) ? ['fieldId'] : [];

  return [
    ...directKeys,
    ...fieldKeys,
  ];
}

function collectRoutingSideEffectKeys(payload) {
  return collectMatchingKeys(payload, ROUTING_SIDE_EFFECT_KEYS);
}

function collectRawLegacyPayloadKeys(payload) {
  return collectMatchingKeys(payload, RAW_LEGACY_PAYLOAD_KEYS);
}

function collectUnknownCompatibilityConfigKeys(config) {
  const value = asObject(config);
  return Object.keys(value).filter(key => !canPolicyAuthoringBridgeSerializeKey(key));
}

function validateCommonPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
      reason: 'Draft command payload must be an object.',
      invalidKeys: [],
    };
  }

  const readOnlyKeys = collectReadOnlyProjectionKeys(payload);
  if (readOnlyKeys.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.READ_ONLY_PROJECTION_MUTATION,
      reason: 'Draft commands cannot mutate read-only evidence or readiness projections.',
      invalidKeys: readOnlyKeys,
    };
  }

  const legacyKeys = collectRawLegacyPayloadKeys(payload);
  if (legacyKeys.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.LEGACY_STORAGE_TERM_LEAK,
      reason: 'Draft commands must not expose raw legacy compatibility payload fields.',
      invalidKeys: legacyKeys,
    };
  }

  const routingKeys = collectRoutingSideEffectKeys(payload);
  if (routingKeys.length > 0) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.ROUTING_SIDE_EFFECT,
      reason: 'Draft commands may declare routing intent but cannot execute routing side effects.',
      invalidKeys: routingKeys,
    };
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Payload passed common policy authoring draft command checks.',
    invalidKeys: [],
  };
}

const POLICY_AUTHORING_DRAFT_COMMAND_RECORDS = deepFreeze([
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SYNC_FROM_SELECTED_PRESETS,
    productLabel: 'Sync Draft From Selected Templates',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.BRIDGE_COMPATIBILITY,
    currentImplementation: 'syncFromSelectedPresets',
    implemented: true,
    operatorFacing: false,
    allowBatchValues: false,
    allowCompatibilitySerialization: false,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.BUILD_SELECTED_PRESETS_FROM_DRAFT,
    productLabel: 'Build Legacy-Compatible Template Output',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.BRIDGE_COMPATIBILITY,
    currentImplementation: 'buildSelectedPresetsFromDraft',
    implemented: true,
    operatorFacing: false,
    allowBatchValues: false,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.APPLY_DRAFT_TO_SELECTED_PRESETS,
    productLabel: 'Apply Draft To Legacy-Compatible Template Output',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.BRIDGE_COMPATIBILITY,
    currentImplementation: 'applyDraftToSelectedPresets',
    implemented: true,
    operatorFacing: false,
    allowBatchValues: false,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL,
    productLabel: 'Add Intent Signal',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: 'addSignal',
    implemented: true,
    operatorFacing: true,
    allowBatchValues: true,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE,
    productLabel: 'Remove Intent Signal Value',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: 'removeSignalValue',
    implemented: true,
    operatorFacing: true,
    allowBatchValues: true,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG,
    productLabel: 'Configure Intent Signal',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: 'setSignalConfig',
    implemented: true,
    operatorFacing: true,
    allowBatchValues: true,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.CONFIGURE_SIGNAL,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG,
    productLabel: 'Clear Intent Signal Configuration',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: 'clearSignalConfig',
    implemented: true,
    operatorFacing: true,
    allowBatchValues: false,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA,
    productLabel: 'Configure Constraint Behavior',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.BRIDGE_COMPATIBILITY,
    currentImplementation: 'setSignalMetadata',
    implemented: true,
    operatorFacing: false,
    allowBatchValues: false,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.CONFIGURE_CONSTRAINT_BEHAVIOR,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL,
    productLabel: 'Ignore Template Signal',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.BRIDGE_COMPATIBILITY,
    currentImplementation: 'setSignalRemoval',
    implemented: true,
    operatorFacing: false,
    allowBatchValues: false,
    allowCompatibilitySerialization: true,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS.IGNORE_TEMPLATE_SIGNAL,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_ROUTING_TARGET,
    productLabel: 'Set Routing Target Intent',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: null,
    implemented: false,
    operatorFacing: true,
    allowBatchValues: false,
    allowCompatibilitySerialization: false,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
  {
    id: POLICY_AUTHORING_DRAFT_COMMAND_IDS.ACKNOWLEDGE_WARNING,
    productLabel: 'Acknowledge Draft Warning',
    categoryId: POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT,
    payloadAuthorityId: POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT,
    currentImplementation: null,
    implemented: false,
    operatorFacing: true,
    allowBatchValues: false,
    allowCompatibilitySerialization: false,
    mayMutateReadOnlyProjection: false,
    productCommandTargetId: null,
  },
]);

function listPolicyAuthoringDraftCommandRecords() {
  return POLICY_AUTHORING_DRAFT_COMMAND_RECORDS;
}

function getPolicyAuthoringDraftCommandRecord(commandId) {
  return POLICY_AUTHORING_DRAFT_COMMAND_RECORDS.find(record => record.id === commandId) || null;
}

function listPolicyAuthoringDraftCommandsByCategory(categoryId) {
  return POLICY_AUTHORING_DRAFT_COMMAND_RECORDS.filter(record => record.categoryId === categoryId);
}

function listPolicyAuthoringDraftCommandsNeedingProductTarget() {
  return POLICY_AUTHORING_DRAFT_COMMAND_RECORDS.filter(record => Boolean(record.productCommandTargetId));
}

function isPolicyAuthoringDraftCommandImplemented(commandId) {
  return getPolicyAuthoringDraftCommandRecord(commandId)?.implemented === true;
}

function isPolicyAuthoringDraftCommandAllowed(commandId) {
  const record = getPolicyAuthoringDraftCommandRecord(commandId);
  if (!record) {
    return false;
  }

  if (record.implemented) {
    return isDraftCommandAllowed(commandId);
  }

  return record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT;
}

function canPolicyAuthoringDraftCommandWriteCompatibilityField(commandId, key) {
  const record = getPolicyAuthoringDraftCommandRecord(commandId);
  return Boolean(record?.allowCompatibilitySerialization) && canPolicyAuthoringBridgeSerializeKey(key);
}

function canPolicyAuthoringDraftCommandMutateReadOnlyProjection(commandId) {
  return getPolicyAuthoringDraftCommandRecord(commandId)?.mayMutateReadOnlyProjection === true;
}

function hasRawLegacyOperatorCommandTerm(record) {
  if (!record?.operatorFacing) {
    return false;
  }

  const text = [
    record.id,
    record.productLabel,
    record.currentImplementation,
  ].filter(Boolean).join(' ');

  return RAW_LEGACY_COMMAND_TERM_PATTERNS.some(pattern => pattern.test(text));
}

function validatePolicyAuthoringDraftCommandRecord(record) {
  if (!record || typeof record !== 'object') {
    return {
      valid: false,
      commandId: null,
      issues: [
        {
          riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
          reason: 'Draft command record is missing or invalid.',
        },
      ],
    };
  }

  const issues = [];

  if (!Object.values(POLICY_AUTHORING_DRAFT_COMMAND_IDS).includes(record.id)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Draft command is not in the policy authoring command vocabulary.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS).includes(record.categoryId)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_CATEGORY,
      reason: 'Draft command has no recognized category.',
    });
  }

  if (!Object.values(POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS).includes(record.payloadAuthorityId)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_PAYLOAD_AUTHORITY,
      reason: 'Draft command has no recognized payload authority.',
    });
  }

  if (record.implemented && !isDraftCommandAllowed(record.id)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.IMPLEMENTED_COMMAND_NOT_ALLOWLISTED,
      reason: 'Implemented draft commands must be allow-listed by the draft state boundary.',
    });
  }

  if (
    record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.FUTURE_OPERATOR_EDIT
    && (record.implemented || record.currentImplementation)
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.FUTURE_COMMAND_HAS_IMPLEMENTATION,
      reason: 'Reserved operator commands must remain unimplemented until server authority and persistence are defined.',
    });
  }

  if (
    record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT
    && record.payloadAuthorityId !== POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.OPERATOR_COMMAND_NOT_PRODUCT_INTENT,
      reason: 'Operator edit commands must carry product-intent payloads.',
    });
  }

  if (
    record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.BRIDGE_SYSTEM
    && record.operatorFacing
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.BRIDGE_COMMAND_OPERATOR_FACING,
      reason: 'Bridge system commands cannot be operator-facing controls.',
    });
  }

  if (
    record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER
    && record.operatorFacing
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.COMPATIBILITY_ADAPTER_OPERATOR_FACING,
      reason: 'Legacy compatibility adapter commands must stay behind product-facing command wrappers.',
    });
  }

  if (
    record.allowBatchValues
    && record.payloadAuthorityId !== POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS.PRODUCT_INTENT
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.BATCH_VALUES_WITHOUT_PRODUCT_INTENT,
      reason: 'Batched values are only supported for product-intent commands.',
    });
  }

  if (
    record.allowCompatibilitySerialization
    && POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS.length === 0
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.COMPATIBILITY_SERIALIZATION_WITHOUT_ALLOWLIST,
      reason: 'Compatibility serialization commands require a bridge serializer allow-list.',
    });
  }

  if (record.mayMutateReadOnlyProjection) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.READ_ONLY_PROJECTION_MUTATION_ALLOWED,
      reason: 'Draft commands cannot mutate server read-only evidence or readiness projections.',
    });
  }

  if (hasRawLegacyOperatorCommandTerm(record)) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.RAW_LEGACY_TERM_IN_OPERATOR_COMMAND,
      reason: 'Operator-facing command labels and identifiers must not expose raw legacy storage terminology.',
    });
  }

  if (
    record.categoryId === POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.LEGACY_COMPATIBILITY_ADAPTER
    && !record.productCommandTargetId
  ) {
    issues.push({
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.MISSING_PRODUCT_COMMAND_TARGET,
      reason: 'Legacy compatibility adapter commands need a product command target.',
    });
  }

  return {
    valid: issues.length === 0,
    commandId: record.id || null,
    issues,
  };
}

function validateValueCommandPayload(payload) {
  const value = asObject(payload);
  const missingFields = ['presetId', 'signalType', 'key']
    .filter(key => !isNonEmptyString(value[key]));

  if (!isNonEmptyScalarOrArray(value.value)) {
    missingFields.push('value');
  }

  return missingFields;
}

function validateConfigCommandPayload(payload) {
  const value = asObject(payload);
  const missingFields = ['presetId', 'signalType']
    .filter(key => !isNonEmptyString(value[key]));

  if (!value.config || typeof value.config !== 'object' || Array.isArray(value.config)) {
    missingFields.push('config');
  }

  return missingFields;
}

function validateSignalIdentityPayload(payload) {
  const value = asObject(payload);
  return ['presetId', 'signalType'].filter(key => !isNonEmptyString(value[key]));
}

function validatePolicyAuthoringDraftCommand({ commandId, payload } = {}) {
  const record = getPolicyAuthoringDraftCommandRecord(commandId);
  if (!record) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Unknown draft command.',
      invalidKeys: [],
      missingFields: [],
    };
  }

  const commonValidation = validateCommonPayload(payload);
  if (!commonValidation.valid) {
    return {
      ...commonValidation,
      commandId,
      missingFields: [],
    };
  }

  if (!record.implemented) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.NOT_IMPLEMENTED,
      reason: 'Draft command is reserved until server authority and persistence are defined.',
      commandId,
      invalidKeys: [],
      missingFields: [],
    };
  }

  if (!isPolicyAuthoringDraftCommandAllowed(commandId)) {
    return {
      valid: false,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Draft command is not allow-listed by the current draft state boundary.',
      commandId,
      invalidKeys: [],
      missingFields: [],
    };
  }

  if (commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.ADD_SIGNAL ||
    commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.REMOVE_SIGNAL_VALUE ||
    commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_REMOVAL) {
    const missingFields = validateValueCommandPayload(payload);
    if (missingFields.length > 0) {
      return {
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
        reason: 'Draft signal value command payload is incomplete.',
        commandId,
        invalidKeys: [],
        missingFields,
      };
    }
  }

  if (commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_CONFIG) {
    const missingFields = validateConfigCommandPayload(payload);
    if (missingFields.length > 0) {
      return {
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
        reason: 'Draft signal configuration command payload is incomplete.',
        commandId,
        invalidKeys: [],
        missingFields,
      };
    }

    const invalidConfigKeys = collectUnknownCompatibilityConfigKeys(asObject(payload).config);
    if (invalidConfigKeys.length > 0) {
      return {
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.ARBITRARY_COMPATIBILITY_FIELD,
        reason: 'Draft signal configuration contains fields outside the bridge serializer allow-list.',
        commandId,
        invalidKeys: invalidConfigKeys,
        missingFields: [],
      };
    }
  }

  if (commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.SET_SIGNAL_METADATA) {
    const value = asObject(payload);
    const missingFields = validateSignalIdentityPayload(payload);
    if (!value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)) {
      missingFields.push('metadata');
    }
    if (missingFields.length > 0) {
      return {
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
        reason: 'Draft signal metadata command payload is incomplete.',
        commandId,
        invalidKeys: [],
        missingFields,
      };
    }
  }

  if (commandId === POLICY_AUTHORING_DRAFT_COMMAND_IDS.CLEAR_SIGNAL_CONFIG) {
    const missingFields = validateSignalIdentityPayload(payload);
    if (missingFields.length > 0) {
      return {
        valid: false,
        riskId: POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS.INVALID_PAYLOAD,
        reason: 'Draft clear command payload is incomplete.',
        commandId,
        invalidKeys: [],
        missingFields,
      };
    }
  }

  return {
    valid: true,
    riskId: null,
    reason: 'Draft command is allow-listed and payload passed policy authoring command boundary checks.',
    commandId,
    invalidKeys: [],
    missingFields: [],
  };
}

function summarizePolicyAuthoringDraftCommandBoundary() {
  const countsByCategory = POLICY_AUTHORING_DRAFT_COMMAND_RECORDS.reduce((counts, record) => {
    counts[record.categoryId] = (counts[record.categoryId] || 0) + 1;
    return counts;
  }, {});

  return {
    commandCount: POLICY_AUTHORING_DRAFT_COMMAND_RECORDS.length,
    countsByCategory,
    implementedCommandIds: POLICY_AUTHORING_DRAFT_COMMAND_RECORDS
      .filter(record => record.implemented)
      .map(record => record.id),
    futureCommandIds: POLICY_AUTHORING_DRAFT_COMMAND_RECORDS
      .filter(record => !record.implemented)
      .map(record => record.id),
    operatorEditCommandIds: listPolicyAuthoringDraftCommandsByCategory(POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS.OPERATOR_EDIT)
      .map(record => record.id),
    productCommandTargetCommandIds: listPolicyAuthoringDraftCommandsNeedingProductTarget().map(record => record.id),
    readOnlyProjectionMutationAllowed: false,
    allowedCompatibilityConfigKeys: POLICY_AUTHORING_BRIDGE_ALLOWED_SERIALIZED_KEYS,
  };
}

function buildPolicyAuthoringDraftCommandBoundaryAudit({ commandRecords = POLICY_AUTHORING_DRAFT_COMMAND_RECORDS } = {}) {
  const commandResults = commandRecords.map(validatePolicyAuthoringDraftCommandRecord);
  const commandIds = commandRecords.map(record => record?.id).filter(Boolean);
  const missingCommandIds = Object.values(POLICY_AUTHORING_DRAFT_COMMAND_IDS)
    .filter(commandId => !commandIds.includes(commandId));
  const duplicateCommandIds = commandIds
    .filter((commandId, index) => commandIds.indexOf(commandId) !== index)
    .filter((commandId, index, allIds) => allIds.indexOf(commandId) === index);
  const issues = [
    ...commandResults.flatMap(result => result.issues.map(issue => ({
      commandId: result.commandId,
      ...issue,
    }))),
    ...missingCommandIds.map(commandId => ({
      commandId,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Required policy authoring draft command is missing.',
    })),
    ...duplicateCommandIds.map(commandId => ({
      commandId,
      riskId: POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS.UNKNOWN_COMMAND,
      reason: 'Draft command appears more than once.',
    })),
  ];

  return {
    ok: issues.length === 0,
    checkedCommandCount: commandRecords.length,
    requiredCommandCount: Object.values(POLICY_AUTHORING_DRAFT_COMMAND_IDS).length,
    commandResults,
    missingCommandIds,
    duplicateCommandIds,
    issues,
  };
}

export {
  POLICY_AUTHORING_DRAFT_COMMAND_AUDIT_RISK_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_CATEGORY_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_PAYLOAD_AUTHORITY_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_PRODUCT_TARGET_IDS,
  POLICY_AUTHORING_DRAFT_COMMAND_RISK_IDS,
  buildPolicyAuthoringDraftCommandBoundaryAudit,
  canPolicyAuthoringDraftCommandMutateReadOnlyProjection,
  canPolicyAuthoringDraftCommandWriteCompatibilityField,
  getPolicyAuthoringDraftCommandRecord,
  isPolicyAuthoringDraftCommandAllowed,
  isPolicyAuthoringDraftCommandImplemented,
  listPolicyAuthoringDraftCommandsNeedingProductTarget,
  listPolicyAuthoringDraftCommandRecords,
  listPolicyAuthoringDraftCommandsByCategory,
  summarizePolicyAuthoringDraftCommandBoundary,
  validatePolicyAuthoringDraftCommand,
  validatePolicyAuthoringDraftCommandRecord,
};
