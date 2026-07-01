import { buildPolicyConfigurationView } from './policyConfigurationView.mjs';
import { buildPolicyIntentContract } from './policyIntentContract.mjs';
import {
  POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
  validatePolicyIntentContract,
} from './policyIntentSchema.mjs';

const PHASE8R_NATIVE_RUNTIME_READ_PATH_VERSION = 'phase8r.native_runtime_read_path.v1';

const PHASE8R_RUNTIME_READ_SOURCE_IDS = Object.freeze({
  NATIVE_INTENT: 'native_intent',
  COMPATIBILITY_BRIDGE: 'compatibility_bridge',
});

const PHASE8R_RUNTIME_READ_STATUS_IDS = Object.freeze({
  NATIVE_INTENT_ACTIVE: 'native_intent_active',
  NATIVE_INTENT_INVALID: 'native_intent_invalid',
  COMPATIBILITY_BRIDGE_FALLBACK: 'compatibility_bridge_fallback',
});

const PHASE8R_RUNTIME_READ_REASON_IDS = Object.freeze({
  ACTIVE_NATIVE_INTENT_FOUND: 'active_native_intent_found',
  NATIVE_CONTRACT_VALIDATED: 'native_contract_validated',
  NATIVE_CONTRACT_INVALID: 'native_contract_invalid',
  COMPATIBILITY_BRIDGE_USED: 'compatibility_bridge_used',
  CONTRACT_SHAPE_STABLE: 'contract_shape_stable',
  SOURCE_TRACE_ATTACHED: 'source_trace_attached',
  CUSTOM_SIGNALS_SUPPRESSED_FOR_NATIVE: 'custom_signals_suppressed_for_native',
  SIDE_EFFECTS_DISABLED: 'side_effects_disabled',
});

const PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS = Object.freeze({
  UNKNOWN_SOURCE: 'unknown_source',
  UNKNOWN_STATUS: 'unknown_status',
  MISSING_CONTRACT: 'missing_contract',
  INVALID_CONTRACT: 'invalid_contract',
  CONTRACT_SHAPE_MISMATCH: 'contract_shape_mismatch',
  MISSING_SOURCE_TRACE: 'missing_source_trace',
  SOURCE_TRACE_MISMATCH: 'source_trace_mismatch',
  NATIVE_READ_DEPENDS_ON_CUSTOM_SIGNALS: 'native_read_depends_on_custom_signals',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
  MISSING_REASON: 'missing_reason',
});

const REQUIRED_CONTRACT_KEYS = Object.freeze([
  'schema_version',
  'policy_id',
  'library_id',
  'library_name',
  'library_media_type',
  'source',
  'inference_state',
  'model',
  'purpose',
  'hard_limits',
  'helpful_hints',
  'avoid',
  'review_behavior',
  'template_links',
  'warnings',
  'unsupported_signals',
  'validation',
]);

const VALID_SOURCE_IDS = Object.freeze(Object.values(PHASE8R_RUNTIME_READ_SOURCE_IDS));
const VALID_STATUS_IDS = Object.freeze(Object.values(PHASE8R_RUNTIME_READ_STATUS_IDS));

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cloneObject(value) {
  return JSON.parse(JSON.stringify(asObject(value)));
}

function buildTrace({
  sourceId,
  statusId,
  policyId,
  intentVersion = null,
}) {
  return {
    source: sourceId,
    status: statusId,
    policy_id: policyId ?? null,
    intent_version: intentVersion,
    attributes: {
      'classifarr.phase8r.read.source': sourceId,
      'classifarr.phase8r.read.status': statusId,
      'classifarr.phase8r.read.policy_id': policyId ?? null,
      'classifarr.phase8r.read.intent_version': intentVersion,
    },
  };
}

function buildReason(reasonId, message, severity = 'info') {
  return {
    reasonId,
    severity,
    message,
  };
}

function findNativeIntentRecord(policy = {}) {
  const explicitNative = policy.nativeIntent || policy.native_intent;
  if (asObject(explicitNative).contract ||
      asObject(explicitNative).policy_intent_contract ||
      asObject(explicitNative).intentContract) {
    return asObject(explicitNative);
  }

  const nativeContract = policy.nativeIntentContract || policy.native_intent_contract;
  if (asObject(nativeContract).schema_version || asObject(nativeContract).purpose) {
    return {
      active: policy.native_intent_active !== false,
      intentVersion: policy.native_intent_version ?? policy.intent_version ?? null,
      contract: nativeContract,
    };
  }

  return null;
}

function isNativeIntentActive(nativeIntent) {
  if (!nativeIntent) return false;
  return nativeIntent.active !== false && nativeIntent.is_active !== false;
}

function getNativeIntentContract(nativeIntent) {
  return asObject(
    nativeIntent?.contract ||
    nativeIntent?.policy_intent_contract ||
    nativeIntent?.intentContract
  );
}

function getNativeIntentVersion(nativeIntent) {
  return nativeIntent?.intentVersion ??
    nativeIntent?.intent_version ??
    nativeIntent?.version ??
    null;
}

function normalizeNativeContract(policy = {}, nativeIntent = {}) {
  const contract = cloneObject(getNativeIntentContract(nativeIntent));
  const normalized = {
    schema_version: contract.schema_version ?? POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: contract.policy_id ?? policy.id ?? null,
    library_id: contract.library_id ?? policy.library_id ?? null,
    library_name: contract.library_name ?? policy.library_name ?? null,
    library_media_type: contract.library_media_type ?? policy.library_media_type ?? null,
    source: POLICY_INTENT_SOURCES.NATIVE_INTENT,
    inference_state: contract.inference_state ?? POLICY_INTENT_INFERENCE_STATES.INFERRED,
    model: {
      ...(asObject(contract.model)),
      mode: 'native_intent',
      intent_supported: true,
      native_intent: true,
      conversion_available: false,
    },
    purpose: asArray(contract.purpose),
    hard_limits: asArray(contract.hard_limits),
    helpful_hints: asArray(contract.helpful_hints),
    avoid: asArray(contract.avoid),
    review_behavior: asObject(contract.review_behavior),
    template_links: asArray(contract.template_links),
    warnings: asArray(contract.warnings),
    unsupported_signals: asArray(contract.unsupported_signals),
  };

  return {
    ...normalized,
    validation: validatePolicyIntentContract(normalized),
  };
}

function buildConfigurationViewFromIntentContract(contract = {}) {
  return {
    schema_version: contract.schema_version ?? POLICY_INTENT_CONTRACT_SCHEMA_VERSION,
    policy_id: contract.policy_id ?? null,
    library_id: contract.library_id ?? null,
    source: PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT,
    presets: [],
    identity_signals: asArray(contract.purpose),
    strict_constraints: asArray(contract.hard_limits),
    compatibility_signals: asArray(contract.helpful_hints),
    boosters: [],
    exclusions: asArray(contract.avoid),
    warnings: asArray(contract.warnings),
    summary: {
      counts: {
        presets: 0,
        identity_signals: asArray(contract.purpose).length,
        strict_constraints: asArray(contract.hard_limits).length,
        compatibility_signals: asArray(contract.helpful_hints).length,
        boosters: 0,
        exclusions: asArray(contract.avoid).length,
        warnings: asArray(contract.warnings).length,
      },
    },
  };
}

function buildCompatibilityReadModel(policy = {}) {
  const configurationView = policy.configuration_view || buildPolicyConfigurationView(policy);
  const policyIntentContract = policy.policy_intent_contract || buildPolicyIntentContract(policy, {
    configurationView,
  });
  const sourceId = PHASE8R_RUNTIME_READ_SOURCE_IDS.COMPATIBILITY_BRIDGE;
  const statusId = PHASE8R_RUNTIME_READ_STATUS_IDS.COMPATIBILITY_BRIDGE_FALLBACK;

  return {
    version: PHASE8R_NATIVE_RUNTIME_READ_PATH_VERSION,
    sourceId,
    statusId,
    configuration_view: configurationView,
    policy_intent_contract: policyIntentContract,
    trace: buildTrace({
      sourceId,
      statusId,
      policyId: policy.id,
    }),
    dependsOnCustomSignals: true,
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsRead: false,
      compatibilityProjectionBuilt: true,
      legacyRowsDeleted: false,
    },
    reasons: [
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.COMPATIBILITY_BRIDGE_USED,
        'No active native intent was attached, so the compatibility bridge remains the read source.'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.SOURCE_TRACE_ATTACHED,
        'Read projection includes bounded source trace metadata.'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.SIDE_EFFECTS_DISABLED,
        'Runtime read projection performs no storage mutation.'
      ),
    ],
  };
}

function buildNativeReadModel(policy = {}, nativeIntent = {}) {
  const policyIntentContract = normalizeNativeContract(policy, nativeIntent);
  const valid = policyIntentContract.validation?.valid === true;
  const sourceId = PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT;
  const statusId = valid
    ? PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_ACTIVE
    : PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_INVALID;
  const intentVersion = getNativeIntentVersion(nativeIntent);

  return {
    version: PHASE8R_NATIVE_RUNTIME_READ_PATH_VERSION,
    sourceId,
    statusId,
    configuration_view: policy.configuration_view ||
      buildConfigurationViewFromIntentContract(policyIntentContract),
    policy_intent_contract: policyIntentContract,
    trace: buildTrace({
      sourceId,
      statusId,
      policyId: policy.id,
      intentVersion,
    }),
    dependsOnCustomSignals: false,
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsRead: true,
      compatibilityProjectionBuilt: false,
      legacyRowsDeleted: false,
    },
    reasons: [
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.ACTIVE_NATIVE_INTENT_FOUND,
        'Active native intent was attached to the policy read model.'
      ),
      buildReason(
        valid
          ? PHASE8R_RUNTIME_READ_REASON_IDS.NATIVE_CONTRACT_VALIDATED
          : PHASE8R_RUNTIME_READ_REASON_IDS.NATIVE_CONTRACT_INVALID,
        valid
          ? 'Native policy intent contract passed server validation.'
          : 'Native policy intent contract failed server validation.',
        valid ? 'info' : 'blocker'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.CONTRACT_SHAPE_STABLE,
        'Native and compatibility read paths expose the same policy_intent_contract shape.'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.SOURCE_TRACE_ATTACHED,
        'Read projection includes bounded source trace metadata.'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.CUSTOM_SIGNALS_SUPPRESSED_FOR_NATIVE,
        'Native runtime read path does not depend on legacy customSignals.'
      ),
      buildReason(
        PHASE8R_RUNTIME_READ_REASON_IDS.SIDE_EFFECTS_DISABLED,
        'Runtime read projection performs no storage mutation.'
      ),
    ],
  };
}

function buildPolicyBuilderPhase8NativeRuntimeReadPath({ policy = {} } = {}) {
  const nativeIntent = findNativeIntentRecord(policy);
  const readModel = nativeIntent && isNativeIntentActive(nativeIntent)
    ? buildNativeReadModel(policy, nativeIntent)
    : buildCompatibilityReadModel(policy);

  return {
    ...readModel,
    validation: validatePolicyBuilderPhase8NativeRuntimeReadPath(readModel),
    nextPhase: {
      phaseId: '8r_5',
      label: 'Rollback Snapshot And Reversion Window',
      reason: 'Runtime reads can now identify native versus compatibility source, so rollback snapshots need bounded restore behavior.',
    },
  };
}

function findMissingContractKeys(contract = {}) {
  return REQUIRED_CONTRACT_KEYS.filter(key => !Object.prototype.hasOwnProperty.call(contract, key));
}

function validatePolicyBuilderPhase8NativeRuntimeReadPath(readModel = {}) {
  const issues = [];
  const contract = asObject(readModel.policy_intent_contract);

  if (!VALID_SOURCE_IDS.includes(readModel.sourceId)) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.UNKNOWN_SOURCE,
      sourceId: readModel.sourceId || null,
      message: 'Runtime read source must be native intent or compatibility bridge.',
    });
  }

  if (!VALID_STATUS_IDS.includes(readModel.statusId)) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.UNKNOWN_STATUS,
      statusId: readModel.statusId || null,
      message: 'Runtime read status must be part of the Phase 8R.4 vocabulary.',
    });
  }

  if (Object.keys(contract).length === 0) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.MISSING_CONTRACT,
      message: 'Runtime read path must expose a policy_intent_contract.',
    });
  }

  findMissingContractKeys(contract).forEach(contractKey => {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.CONTRACT_SHAPE_MISMATCH,
      contractKey,
      message: 'Runtime read path must preserve the policy intent contract shape.',
    });
  });

  if (contract.validation?.valid !== true &&
      readModel.statusId !== PHASE8R_RUNTIME_READ_STATUS_IDS.NATIVE_INTENT_INVALID) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.INVALID_CONTRACT,
      message: 'Invalid policy intent contracts must not be exposed as successful runtime reads.',
    });
  }

  if (!readModel.trace?.source) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.MISSING_SOURCE_TRACE,
      message: 'Runtime read path must include bounded source trace metadata.',
    });
  } else if (readModel.trace.source !== readModel.sourceId ||
      readModel.trace.attributes?.['classifarr.phase8r.read.source'] !== readModel.sourceId) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.SOURCE_TRACE_MISMATCH,
      message: 'Runtime read trace source must match the selected read source.',
    });
  }

  if (readModel.sourceId === PHASE8R_RUNTIME_READ_SOURCE_IDS.NATIVE_INTENT &&
      readModel.dependsOnCustomSignals === true) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.NATIVE_READ_DEPENDS_ON_CUSTOM_SIGNALS,
      message: 'Converted native runtime reads must not depend on legacy customSignals.',
    });
  }

  Object.entries(readModel.sideEffects || {}).forEach(([key, value]) => {
    if (key !== 'nativeRowsRead' && key !== 'compatibilityProjectionBuilt' && value === true) {
      issues.push({
        riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.SIDE_EFFECT_PERFORMED,
        message: `Phase 8R.4 native runtime read path cannot perform side effect "${key}".`,
      });
    }
  });

  if (asArray(readModel.reasons).length === 0) {
    issues.push({
      riskId: PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS.MISSING_REASON,
      message: 'Runtime read path must include bounded read-source reasons.',
    });
  }

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyBuilderPhase8NativeRuntimeReadPathAudit(
  readModel = buildPolicyBuilderPhase8NativeRuntimeReadPath()
) {
  const validation = validatePolicyBuilderPhase8NativeRuntimeReadPath(readModel);

  return {
    ok: validation.ok,
    issueCount: validation.issueCount,
    sourceId: readModel.sourceId || null,
    statusId: readModel.statusId || null,
    validation,
    nextPhase: readModel.nextPhase || {
      phaseId: '8r_5',
      label: 'Rollback Snapshot And Reversion Window',
      reason: 'Native runtime reads are source-traceable; bounded rollback behavior is next.',
    },
  };
}

export {
  PHASE8R_NATIVE_RUNTIME_READ_PATH_VERSION,
  PHASE8R_RUNTIME_READ_AUDIT_RISK_IDS,
  PHASE8R_RUNTIME_READ_REASON_IDS,
  PHASE8R_RUNTIME_READ_SOURCE_IDS,
  PHASE8R_RUNTIME_READ_STATUS_IDS,
  buildPolicyBuilderPhase8NativeRuntimeReadPath,
  buildPolicyBuilderPhase8NativeRuntimeReadPathAudit,
  validatePolicyBuilderPhase8NativeRuntimeReadPath,
};
