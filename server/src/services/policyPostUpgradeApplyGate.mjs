import { buildPolicyIntentContract } from './policyIntentContract.mjs';
import {
  POLICY_INTENT_INFERENCE_STATES,
  POLICY_INTENT_SOURCES,
} from './policyIntentSchema.mjs';
import {
  buildNativeIntentAuthoritySqlPredicate,
  buildNativeIntentMaterializationEligibility,
} from './policyNativeIntentAuthorityEligibility.mjs';
import {
  POLICY_INTENT_CONVERSION_STEP_STATUS_IDS as POLICY_CONVERSION_STEP_STATUS_IDS,
} from './policyIntentConversionWorkflow.mjs';
import {
  DRY_RUN_CURRENT_WINDOW_MINUTES,
  POLICY_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS,
  POLICY_POST_UPGRADE_DRY_RUN_STATUS_IDS,
  buildPolicyPostUpgradeDryRun,
  loadPolicyPostUpgradeCandidateInputs,
} from './policyPostUpgradeDryRun.mjs';
import { lockPolicyNativeIntentAuthority } from './policyNativeIntentAuthorityLock.mjs';
import { POLICY_CONVERSION_ACTOR_SOURCE_IDS } from './policyConversionActorSources.mjs';

const POLICY_POST_UPGRADE_APPLY_GATE_VERSION = 'policy.post_upgrade_apply_gate.v1';
const DEFAULT_TARGET_VERSION = 1;
const DEFAULT_ROLLBACK_WINDOW_DAYS = 14;

const POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS = Object.freeze({
  READY_TO_APPLY: 'ready_to_apply',
  APPLIED: 'applied',
  BLOCKED_BY_DRY_RUN: 'blocked_by_dry_run',
  BLOCKED_BY_STALE_DRY_RUN: 'blocked_by_stale_dry_run',
  BLOCKED_BY_NO_READY_STEPS: 'blocked_by_no_ready_steps',
  BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
  FAILED_ROLLED_BACK: 'failed_rolled_back',
  DEFERRED_BY_EXECUTION_BUDGET: 'deferred_by_execution_budget',
});

const POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS = Object.freeze({
  DRY_RUN_REQUIRED: 'dry_run_required',
  DRY_RUN_INVALID: 'dry_run_invalid',
  DRY_RUN_STALE: 'dry_run_stale',
  NO_READY_STEPS: 'no_ready_steps',
  TRANSACTION_BOUNDARY_REQUIRED: 'transaction_boundary_required',
  APPLY_FAILED_ROLLED_BACK: 'apply_failed_rolled_back',
  POLICY_INPUT_MISSING: 'policy_input_missing',
  POLICY_AUTHORITY_UNAVAILABLE: 'policy_authority_unavailable',
  CONTRACT_VALIDATION_FAILED: 'contract_validation_failed',
  NON_MATERIALIZABLE_INTENT_CONTRACT: 'non_materializable_intent_contract',
  CONVERSION_ACTION_INVALID: 'conversion_action_invalid',
  EXECUTION_BUDGET_EXHAUSTED: 'execution_budget_exhausted',
});

const APPLY_AUDIT_CONTEXT_BY_ACTOR_SOURCE_ID = Object.freeze({
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY]: {
    actorType: 'post_upgrade',
    defaultReasonCode: 'policy_post_upgrade_apply',
    summaryPrefix: 'Policy post-upgrade native intent conversion',
  },
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.NATIVE_INTENT_RECONCILIATION]: {
    actorType: 'reconciler',
    defaultReasonCode: 'native_intent_reconciliation',
    summaryPrefix: 'Policy native intent reconciliation',
  },
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.TEST_FIXTURE]: {
    actorType: 'test_fixture',
    defaultReasonCode: 'test_fixture_native_intent_conversion',
    summaryPrefix: 'Policy test-fixture native intent conversion',
  },
  [POLICY_CONVERSION_ACTOR_SOURCE_IDS.MAINTAINER_MIGRATION_TOOL]: {
    actorType: 'maintainer',
    defaultReasonCode: 'maintainer_native_intent_conversion',
    summaryPrefix: 'Policy maintainer native intent conversion',
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildApplyAuditContext({ dryRun = {}, actorId = null } = {}) {
  const action = asObject(dryRun?.conversionWorkflow?.action);
  const actorSourceId = normalizeString(action.actorSourceId);
  const actorConfig = APPLY_AUDIT_CONTEXT_BY_ACTOR_SOURCE_ID[actorSourceId];
  const normalizedActorId = normalizePositiveInteger(actorId ?? action.actorId);

  if (!actorConfig) {
    return null;
  }

  return {
    actorSourceId,
    actorType: actorConfig.actorType,
    actorId: normalizedActorId,
    reasonCode: normalizeString(action.reasonCode) || actorConfig.defaultReasonCode,
    summaryPrefix: actorConfig.summaryPrefix,
  };
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function addDays(timestamp, days) {
  const date = new Date(timestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function isTimestampExpired(expiresAt, now) {
  const expiresAtDate = new Date(expiresAt);
  const nowDate = new Date(now);
  if (Number.isNaN(expiresAtDate.getTime()) || Number.isNaN(nowDate.getTime())) {
    return true;
  }
  return expiresAtDate.getTime() < nowDate.getTime();
}

function getReadySteps(dryRun = {}) {
  const normalizedDryRun = asObject(dryRun);
  return asArray(normalizedDryRun.conversionWorkflow?.steps)
    .filter(step => step.statusId === POLICY_CONVERSION_STEP_STATUS_IDS.READY_TO_APPLY);
}

function sortReadyStepsByPolicyAuthority(steps = []) {
  return [...asArray(steps)].sort((left, right) => {
    const leftPolicyId = Number(left?.policyId);
    const rightPolicyId = Number(right?.policyId);

    if (Number.isInteger(leftPolicyId) && Number.isInteger(rightPolicyId) && leftPolicyId !== rightPolicyId) {
      return leftPolicyId - rightPolicyId;
    }

    return String(left?.idempotencyKey || '').localeCompare(String(right?.idempotencyKey || ''));
  });
}

function unique(values) {
  return [...new Set(asArray(values).filter(Boolean))];
}

function classifyApplyFailureCategory(error = {}) {
  const operatorErrorId = normalizeString(error.operatorErrorId);
  if (operatorErrorId) return operatorErrorId;

  const code = normalizeString(error.code).toUpperCase();
  if ([
    '40001', '40P01', '55P03',
    '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
    'ECONNABORTED', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH',
    'ENETUNREACH', 'EPIPE', 'ETIMEDOUT',
  ].includes(code)) {
    return 'transient_database';
  }

  return POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.APPLY_FAILED_ROLLED_BACK;
}

function getDryRunOperatorErrors(dryRun = {}) {
  return asArray(dryRun.operatorErrorIds)
    .filter(errorId => errorId !== POLICY_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.OPERATOR_REVIEW_REQUIRED);
}

function determineApplyGateStatus({ dryRun, now, readySteps, hasTransactionBoundary }) {
  if (!dryRun) {
    return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN;
  }

  if (
    dryRun.validation?.ok !== true ||
    dryRun.statusId !== POLICY_POST_UPGRADE_DRY_RUN_STATUS_IDS.READY_FOR_APPLY_GATE ||
    getDryRunOperatorErrors(dryRun).length > 0
  ) {
    return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN;
  }

  if (isTimestampExpired(dryRun.expiresAt, now)) {
    return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_STALE_DRY_RUN;
  }

  if (readySteps.length === 0) {
    return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_NO_READY_STEPS;
  }

  if (!hasTransactionBoundary) {
    return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY;
  }

  return POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.READY_TO_APPLY;
}

function buildApplyGateOperatorErrorIds({ dryRun, statusId }) {
  const errors = [];

  if (!dryRun) {
    errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_REQUIRED);
  } else {
    if (dryRun.validation?.ok !== true ||
        dryRun.statusId !== POLICY_POST_UPGRADE_DRY_RUN_STATUS_IDS.READY_FOR_APPLY_GATE) {
      errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_INVALID);
    }

    if (getDryRunOperatorErrors(dryRun).length > 0) {
      errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_INVALID);
    }
  }

  if (statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_STALE_DRY_RUN) {
    errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.DRY_RUN_STALE);
  }

  if (statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_NO_READY_STEPS) {
    errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.NO_READY_STEPS);
  }

  if (statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_TRANSACTION_BOUNDARY) {
    errors.push(POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.TRANSACTION_BOUNDARY_REQUIRED);
  }

  return unique(errors);
}

function buildPolicyPostUpgradeApplyGate({
  dryRun = null,
  hasTransactionBoundary = false,
  now = null,
} = {}) {
  const evaluatedAt = normalizeTimestamp(now);
  const readySteps = getReadySteps(dryRun);
  const statusId = determineApplyGateStatus({
    dryRun,
    now: evaluatedAt,
    readySteps,
    hasTransactionBoundary,
  });
  const operatorErrorIds = buildApplyGateOperatorErrorIds({
    dryRun,
    statusId,
  });
  const gate = {
    version: POLICY_POST_UPGRADE_APPLY_GATE_VERSION,
    mode: 'apply_gate',
    statusId,
    evaluatedAt,
    dryRunGeneratedAt: dryRun?.generatedAt ?? null,
    dryRunExpiresAt: dryRun?.expiresAt ?? null,
    dryRunWindowMinutes: DRY_RUN_CURRENT_WINDOW_MINUTES,
    readyPolicyIds: readySteps.map(step => step.policyId),
    operatorErrorIds,
    summary: {
      readyToApplyCount: readySteps.length,
      dryRunStatusId: dryRun?.statusId ?? null,
      dryRunValidationOk: dryRun?.validation?.ok === true,
      transactionBoundaryAvailable: hasTransactionBoundary === true,
    },
    sideEffects: {
      rollbackSnapshotsWritten: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      legacyPathsDeleted: false,
      policyStorageMutated: false,
    },
    nextStep: {
      stepId: 'native_runtime_cutover_verification',
      label: 'Native Runtime Cutover Verification',
      reason: 'Post-upgrade apply can now be transaction-gated, so the next step is proving converted runtime reads and support rollback behavior before deleting compatibility paths.',
    },
  };

  return {
    ...gate,
    validation: validatePolicyPostUpgradeApplyGate(gate),
  };
}

function validatePolicyPostUpgradeApplyGate(gate = {}) {
  const issues = [];

  if (gate.mode !== 'apply_gate') {
    issues.push({
      riskId: 'apply_gate_wrong_mode',
      message: 'Policy post-upgrade apply must run through an apply gate.',
    });
  }

  if (
    gate.statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.READY_TO_APPLY &&
    gate.summary?.transactionBoundaryAvailable !== true
  ) {
    issues.push({
      riskId: 'ready_without_transaction_boundary',
      message: 'Apply gate cannot be ready without an available transaction boundary.',
    });
  }

  if (
    gate.statusId === POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.READY_TO_APPLY &&
    asArray(gate.readyPolicyIds).length === 0
  ) {
    issues.push({
      riskId: 'ready_without_ready_policies',
      message: 'Apply gate cannot be ready without ready policy IDs.',
    });
  }

  Object.entries(asObject(gate.sideEffects)).forEach(([key, value]) => {
    if (value === true && gate.statusId !== POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED) {
      issues.push({
        riskId: 'apply_gate_side_effect_before_apply',
        message: `Apply gate cannot report side effect "${key}" before successful apply.`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

function buildPolicyMap(policies) {
  return new Map(asArray(policies).map(policy => [String(policy.id), policy]));
}

function mapTemplateLinkState(linkState) {
  return ['applied', 'removed', 'replaced', 'ignored'].includes(linkState)
    ? linkState
    : 'applied';
}

function buildRulesFromContract(contract = {}) {
  const collections = [
    ['purpose', 'purpose'],
    ['hard_limits', 'hard_limit'],
    ['helpful_hints', 'helpful_hint'],
    ['avoid', 'avoid'],
  ];

  return collections.flatMap(([collection, intentRole]) =>
    asArray(contract[collection]).map((entry, index) => ({
      intent_role: intentRole,
      collection,
      signal_type: entry.signal_type,
      operator: entry.operator,
      values: asObject(entry.values),
      constraint_mode: entry.constraint_mode ?? null,
      semantics: entry.semantics ?? null,
      source: entry.source ?? null,
      inference_state: entry.inference_state ?? contract.inference_state,
      sort_order: index,
    }))
  );
}

function buildRollbackSnapshotPayload({ policy, contract, step, appliedAt }) {
  return {
    policy_id: policy.id ?? null,
    library_id: policy.library_id ?? null,
    captured_at: appliedAt,
    payload_redacted: false,
    restore_sections: [
      'preset_attachments',
      'weights',
      'thresholds',
      'custom_signals',
      'routing_mapping_references',
      'migration_actor',
      'migration_reason',
    ],
    legacy_policy: {
      name: policy.name ?? null,
      description: policy.description ?? null,
      auto_classify_threshold: policy.auto_classify_threshold ?? null,
      prompt_threshold: policy.prompt_threshold ?? null,
      require_ai_validation: policy.require_ai_validation ?? null,
      trust_patterns: policy.trust_patterns ?? null,
      trust_rag: policy.trust_rag ?? null,
      trust_history: policy.trust_history ?? null,
      preset_weight: policy.preset_weight ?? null,
      profile_weight: policy.profile_weight ?? null,
      pattern_weight: policy.pattern_weight ?? null,
      rag_weight: policy.rag_weight ?? null,
      history_weight: policy.history_weight ?? null,
      combination_mode: policy.combination_mode ?? null,
    },
    presets: asArray(policy.presets).map(preset => ({
      preset_id: preset.preset_id ?? preset.id ?? null,
      preset_key: preset.key ?? null,
      preset_name: preset.name ?? null,
      weight: preset.weight ?? null,
      custom_signals: preset.custom_signals ?? preset.customSignals ?? null,
      sort_order: preset.sort_order ?? null,
    })),
    routing_target: step.routingTarget ?? null,
    contract_summary: {
      schema_version: contract.schema_version,
      source: contract.source,
      inference_state: contract.inference_state,
      purpose_count: asArray(contract.purpose).length,
      hard_limit_count: asArray(contract.hard_limits).length,
      helpful_hint_count: asArray(contract.helpful_hints).length,
      avoid_count: asArray(contract.avoid).length,
    },
  };
}

async function queryAlreadyConvertedIntent(client, policyId, targetVersion) {
  const result = await client.query(
    `SELECT id
     FROM policy_intents
     WHERE policy_id = $1
       AND intent_version = $2
       AND ${buildNativeIntentAuthoritySqlPredicate({ intentAlias: 'policy_intents' })}
     LIMIT 1`,
    [policyId, targetVersion]
  );

  return result.rows?.[0]?.id ?? null;
}

async function insertPolicyIntentHeader({ client, policy, contract, targetVersion, appliedAt, actorId }) {
  await client.query(
    `UPDATE policy_intents
     SET active = FALSE, updated_at = $2
     WHERE policy_id = $1
       AND active = TRUE`,
    [policy.id, appliedAt]
  );

  const result = await client.query(
    `INSERT INTO policy_intents (
       policy_id,
       library_id,
       schema_version,
       intent_version,
       active,
       source,
       inference_state,
       review_behavior,
       validation_status,
       created_by,
       accepted_at,
       accepted_by
     )
     VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7::jsonb, $8, $9, $10, $9)
     RETURNING id`,
    [
      policy.id,
      policy.library_id,
      contract.schema_version,
      targetVersion,
      POLICY_INTENT_SOURCES.NATIVE_INTENT,
      POLICY_INTENT_INFERENCE_STATES.INFERRED,
      JSON.stringify(asObject(contract.review_behavior)),
      contract.validation?.warning_count > 0 ? 'warning' : 'valid',
      actorId,
      appliedAt,
    ]
  );

  return result.rows?.[0]?.id;
}

async function insertMigrationEvent({
  client,
  intentId,
  policyId,
  eventType,
  actorType,
  actorId,
  reasonCode,
  summary,
  metadata,
  actorSourceId = null,
  targetVersion = DEFAULT_TARGET_VERSION,
}) {
  await client.query(
    `INSERT INTO policy_intent_migration_events (
       intent_id,
       policy_id,
       event_type,
       actor_type,
       actor_id,
       source_version,
       target_version,
       reason_code,
       summary,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9::jsonb)`,
    [
      intentId,
      policyId,
      eventType,
      actorType,
      actorId,
      targetVersion,
      reasonCode,
      summary,
      JSON.stringify({
        ...asObject(metadata),
        ...(normalizeString(actorSourceId) ? { actorSourceId: normalizeString(actorSourceId) } : {}),
      }),
    ]
  );
}

async function insertRollbackSnapshot({ client, intentId, policy, contract, step, appliedAt }) {
  const payload = buildRollbackSnapshotPayload({
    policy,
    contract,
    step,
    appliedAt,
  });
  const expiresAt = step.rollbackSnapshot?.expiresAt || addDays(appliedAt, DEFAULT_ROLLBACK_WINDOW_DAYS);

  await client.query(
    `INSERT INTO policy_intent_rollback_snapshots (
       intent_id,
       policy_id,
       snapshot_version,
       snapshot_payload,
       payload_redacted,
       restore_path,
       expires_at
     )
     VALUES ($1, $2, $3, $4::jsonb, FALSE, $5, $6)`,
    [
      intentId,
      policy.id,
      DEFAULT_TARGET_VERSION,
      JSON.stringify(payload),
      step.rollbackSnapshot?.restorePath || `policy/post-upgrade/rollback/policies/${policy.id}/v${DEFAULT_TARGET_VERSION}`,
      expiresAt,
    ]
  );
}

async function insertIntentRules({ client, intentId, contract }) {
  const rules = buildRulesFromContract(contract);

  for (const rule of rules) {
    await client.query(
      `INSERT INTO policy_intent_rules (
         intent_id,
         intent_role,
         collection,
         signal_type,
         operator,
         values,
         constraint_mode,
         semantics,
         source,
         inference_state,
         sort_order
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)`,
      [
        intentId,
        rule.intent_role,
        rule.collection,
        rule.signal_type,
        rule.operator,
        JSON.stringify(rule.values),
        rule.constraint_mode,
        rule.semantics,
        rule.source,
        rule.inference_state,
        rule.sort_order,
      ]
    );
  }

  return rules.length;
}

async function insertRoutingTarget({ client, intentId, policy, step }) {
  const routingTarget = step.routingTarget || {};
  const targetStatus = routingTarget.configured === true ? 'configured' : 'missing';

  await client.query(
    `INSERT INTO policy_intent_routing_targets (
       intent_id,
       library_id,
       arr_type,
       arr_config_id,
       arr_root_folder_id,
       arr_root_folder_path,
       quality_profile_id,
       target_status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      intentId,
      policy.library_id,
      routingTarget.arrType ?? routingTarget.arr_type ?? null,
      routingTarget.arrConfigId ?? routingTarget.arr_config_id ?? null,
      policy.libraryMapping?.arr_root_folder_id ?? null,
      routingTarget.rootFolderPath ?? routingTarget.arr_root_folder_path ?? null,
      policy.libraryMapping?.quality_profile_id ?? policy.quality_profile_id ?? null,
      targetStatus,
    ]
  );
}

async function insertTemplateApplications({ client, intentId, contract }) {
  const links = asArray(contract.template_links);

  for (const link of links) {
    await client.query(
      `INSERT INTO policy_intent_template_applications (
         intent_id,
         preset_id,
         preset_key,
         preset_name,
         weight,
         signal_count,
         link_state
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        intentId,
        link.preset_id ?? null,
        link.preset_key ?? null,
        link.preset_name ?? null,
        link.weight ?? null,
        link.signal_count ?? 0,
        mapTemplateLinkState(link.link_state),
      ]
    );
  }

  return links.length;
}

async function insertValidationStatus({ client, intentId, contract }) {
  await client.query(
    `INSERT INTO policy_intent_validation_status (
       intent_id,
       schema_version,
       status,
       validator_version,
       error_count,
       warning_count,
       errors,
       warnings
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
    [
      intentId,
      contract.schema_version,
      contract.validation?.warning_count > 0 ? 'warning' : 'valid',
      'policy_intent_contract',
      contract.validation?.error_count ?? 0,
      contract.validation?.warning_count ?? 0,
      JSON.stringify(asArray(contract.validation?.errors)),
      JSON.stringify(asArray(contract.validation?.warnings)),
    ]
  );
}

function createExecutionBudgetError() {
  const error = new Error('Native intent conversion execution budget exhausted.');
  error.operatorErrorId = POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.EXECUTION_BUDGET_EXHAUSTED;
  return error;
}

function isExecutionDeadlineExceeded(deadlineAt) {
  if (!deadlineAt) return false;

  const deadline = new Date(deadlineAt);
  return Number.isNaN(deadline.getTime()) || Date.now() >= deadline.getTime();
}

async function configureExecutionDeadline(client, deadlineAt) {
  if (!deadlineAt) return;

  const deadline = new Date(deadlineAt);
  const remainingMs = deadline.getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    throw createExecutionBudgetError();
  }

  await client.query(
    "SELECT set_config('statement_timeout', $1, TRUE)",
    [String(Math.max(1, Math.trunc(remainingMs)))],
  );
}

async function applyReadyStep({
  client,
  policy,
  step,
  auditContext,
  appliedAt,
  targetVersion,
  policyWriteGuard = null,
}) {
  const lockedPolicy = await lockPolicyNativeIntentAuthority(client, {
    policyId: policy.id,
    libraryId: policy.library_id,
  });
  if (!lockedPolicy) {
    const error = new Error(`Policy authority is unavailable for post-upgrade apply: ${policy.id}`);
    error.operatorErrorId = POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.POLICY_AUTHORITY_UNAVAILABLE;
    throw error;
  }

  if (typeof policyWriteGuard === 'function') {
    const guardResult = await policyWriteGuard({
      client,
      policyId: Number(policy.id),
      auditContext,
    });
    if (guardResult?.allowed === false) {
      return {
        policyId: policy.id,
        alreadyConverted: false,
        skippedByReconciliationGuard: true,
        guardReasonId: typeof guardResult.reasonId === 'string'
          ? guardResult.reasonId
          : 'rollback_reconciliation_hold',
        rulesInserted: 0,
        templateApplicationsInserted: 0,
      };
    }
  }

  const existingIntentId = await queryAlreadyConvertedIntent(client, policy.id, targetVersion);
  if (existingIntentId) {
    return {
      policyId: policy.id,
      intentId: Number(existingIntentId),
      alreadyConverted: true,
      rulesInserted: 0,
      templateApplicationsInserted: 0,
    };
  }

  const contract = buildPolicyIntentContract(policy);
  const materializationEligibility = buildNativeIntentMaterializationEligibility(contract);
  if (contract.validation?.valid !== true) {
    const error = new Error(`Policy ${policy.id} failed native intent validation during apply.`);
    error.operatorErrorId = POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.CONTRACT_VALIDATION_FAILED;
    throw error;
  }
  if (!materializationEligibility.materializable) {
    const error = new Error(`Policy ${policy.id} does not have a materializable native intent contract.`);
    error.operatorErrorId =
      POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.NON_MATERIALIZABLE_INTENT_CONTRACT;
    throw error;
  }

  const intentId = await insertPolicyIntentHeader({
    client,
    policy,
    contract,
    targetVersion,
    appliedAt,
    actorId: auditContext.actorId,
  });

  await insertMigrationEvent({
    client,
    intentId,
    policyId: policy.id,
    eventType: 'conversion_started',
    actorType: auditContext.actorType,
    actorId: auditContext.actorId,
    reasonCode: auditContext.reasonCode,
    summary: `${auditContext.summaryPrefix} started.`,
    metadata: {
      idempotencyKey: step.idempotencyKey,
      conversionSource: contract.source,
      conversionInferenceState: contract.inference_state,
    },
    actorSourceId: auditContext.actorSourceId,
    targetVersion,
  });
  await insertRollbackSnapshot({ client, intentId, policy, contract, step, appliedAt });
  await insertMigrationEvent({
    client,
    intentId,
    policyId: policy.id,
    eventType: 'rollback_snapshot_created',
    actorType: auditContext.actorType,
    actorId: auditContext.actorId,
    reasonCode: auditContext.reasonCode,
    summary: `Rollback snapshot created before ${auditContext.summaryPrefix.toLowerCase()}.`,
    metadata: { restorePath: step.rollbackSnapshot?.restorePath ?? null },
    actorSourceId: auditContext.actorSourceId,
    targetVersion,
  });
  const rulesInserted = await insertIntentRules({ client, intentId, contract });
  await insertRoutingTarget({ client, intentId, policy, step });
  const templateApplicationsInserted = await insertTemplateApplications({ client, intentId, contract });
  await insertValidationStatus({ client, intentId, contract });
  await insertMigrationEvent({
    client,
    intentId,
    policyId: policy.id,
    eventType: 'conversion_applied',
    actorType: auditContext.actorType,
    actorId: auditContext.actorId,
    reasonCode: auditContext.reasonCode,
    summary: `${auditContext.summaryPrefix} applied.`,
    metadata: {
      idempotencyKey: step.idempotencyKey,
      rulesInserted,
      templateApplicationsInserted,
    },
    actorSourceId: auditContext.actorSourceId,
    targetVersion,
  });

  return {
    policyId: policy.id,
    intentId: Number(intentId),
    alreadyConverted: false,
    rulesInserted,
    templateApplicationsInserted,
  };
}

async function applyPolicyPostUpgradeApplyGate({
  dbClient,
  dryRun,
  policies = [],
  now = null,
  actorId = null,
  targetVersion = DEFAULT_TARGET_VERSION,
  executionDeadlineAt = null,
  policyWriteGuard = null,
} = {}) {
  const appliedAt = normalizeTimestamp(now);
  const gate = buildPolicyPostUpgradeApplyGate({
    dryRun,
    hasTransactionBoundary: typeof dbClient?.withTransaction === 'function',
    now: appliedAt,
  });

  if (gate.statusId !== POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.READY_TO_APPLY) {
    return {
      ...gate,
      applied: false,
      appliedPolicyCount: 0,
      results: [],
    };
  }

  if (isExecutionDeadlineExceeded(executionDeadlineAt)) {
    return {
      ...gate,
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.DEFERRED_BY_EXECUTION_BUDGET,
      applied: false,
      appliedPolicyCount: 0,
      results: [],
      operatorErrorIds: unique([
        ...asArray(gate.operatorErrorIds),
        POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.EXECUTION_BUDGET_EXHAUSTED,
      ]),
    };
  }

  const auditContext = buildApplyAuditContext({ dryRun, actorId });
  if (!auditContext) {
    return {
      ...gate,
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.BLOCKED_BY_DRY_RUN,
      applied: false,
      appliedPolicyCount: 0,
      results: [],
      operatorErrorIds: unique([
        ...asArray(gate.operatorErrorIds),
        POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.CONVERSION_ACTION_INVALID,
      ]),
    };
  }

  const policyMap = buildPolicyMap(policies);

  try {
    const results = await dbClient.withTransaction(async (client) => {
      await configureExecutionDeadline(client, executionDeadlineAt);
      const readySteps = sortReadyStepsByPolicyAuthority(getReadySteps(dryRun));
      const applied = [];

      for (const step of readySteps) {
        if (isExecutionDeadlineExceeded(executionDeadlineAt)) {
          throw createExecutionBudgetError();
        }
        const policy = policyMap.get(String(step.policyId));
        if (!policy) {
          const error = new Error(`Policy input missing for post-upgrade apply: ${step.policyId}`);
          error.operatorErrorId = POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.POLICY_INPUT_MISSING;
          throw error;
        }

        applied.push(await applyReadyStep({
          client,
          policy,
          step,
          auditContext,
          appliedAt,
          targetVersion,
          policyWriteGuard,
        }));
      }

      return applied;
    });

    return {
      ...gate,
      statusId: POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.APPLIED,
      applied: true,
      appliedPolicyCount: results.filter(result => (
        result.alreadyConverted !== true && result.skippedByReconciliationGuard !== true
      )).length,
      alreadyConvertedCount: results.filter(result => result.alreadyConverted === true).length,
      results,
      sideEffects: {
        rollbackSnapshotsWritten: results.some(result => (
          result.alreadyConverted !== true && result.skippedByReconciliationGuard !== true
        )),
        nativeRowsInserted: results.some(result => (
          result.alreadyConverted !== true && result.skippedByReconciliationGuard !== true
        )),
        migrationEventsWritten: results.some(result => (
          result.alreadyConverted !== true && result.skippedByReconciliationGuard !== true
        )),
        legacyPathsDeleted: false,
        policyStorageMutated: false,
      },
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    };
  } catch (error) {
    const failureCategory = classifyApplyFailureCategory(error);
    return {
      ...gate,
      statusId: error.operatorErrorId === POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS.EXECUTION_BUDGET_EXHAUSTED
        ? POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.DEFERRED_BY_EXECUTION_BUDGET
        : POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS.FAILED_ROLLED_BACK,
      applied: false,
      appliedPolicyCount: 0,
      results: [],
      operatorErrorIds: unique([
        ...asArray(gate.operatorErrorIds),
        failureCategory,
      ]),
      failureCategory,
      rollback: {
        assumedComplete: true,
        reason: 'db.withTransaction rejected and is expected to roll back the transaction.',
      },
      sideEffects: {
        rollbackSnapshotsWritten: false,
        nativeRowsInserted: false,
        migrationEventsWritten: false,
        legacyPathsDeleted: false,
        policyStorageMutated: false,
      },
      validation: {
        ok: true,
        issueCount: 0,
        issues: [],
      },
    };
  }
}

async function runPolicyPostUpgradeApplyGate({
  dbClient,
  maxPolicies,
  now = null,
  actorId = null,
  unconvertedOnly = false,
  excludeRevertedPolicies = false,
  action = null,
  executionDeadlineAt = null,
  includeReconciliationCandidates = false,
} = {}) {
  const { policies, activeIntentIntegrityReport } = await loadPolicyPostUpgradeCandidateInputs({
    dbClient,
    maxPolicies,
    unconvertedOnly,
    excludeRevertedPolicies,
  });
  const dryRun = buildPolicyPostUpgradeDryRun({
    policies,
    maxPolicies,
    now,
    activeIntentIntegrityReport,
    action,
  });

  const result = await applyPolicyPostUpgradeApplyGate({
    dbClient,
    dryRun,
    policies,
    now,
    actorId,
    executionDeadlineAt,
  });

  if (includeReconciliationCandidates !== true) {
    return result;
  }

  return {
    ...result,
    reconciliationCandidates: asArray(dryRun.candidateReport?.candidates)
      .map(candidate => ({
        policyId: candidate.policyId,
        statusId: candidate.statusId,
        canConvert: candidate.canConvert === true,
        reasonIds: asArray(candidate.reasons).map(reason => reason?.reasonId),
        intentContract: {
          schemaVersion: candidate.intentContract?.schemaVersion,
          source: candidate.intentContract?.source,
          inferenceState: candidate.intentContract?.inferenceState,
          valid: candidate.intentContract?.valid === true,
          errorCount: candidate.intentContract?.errorCount,
          warningCount: candidate.intentContract?.warningCount,
          unsupportedSignalCount: candidate.intentContract?.unsupportedSignalCount,
        },
        authorityEligibility: candidate.authorityEligibility
          ? {
            stateId: candidate.authorityEligibility.stateId,
            integrityStatusId: candidate.authorityEligibility.integrityStatusId,
            activeIntentCount: candidate.authorityEligibility.activeIntentCount,
          }
          : undefined,
      }))
      .filter(candidate => candidate.policyId !== null && candidate.policyId !== undefined),
  };
}

export {
  POLICY_POST_UPGRADE_APPLY_GATE_OPERATOR_ERROR_IDS,
  POLICY_POST_UPGRADE_APPLY_GATE_STATUS_IDS,
  POLICY_POST_UPGRADE_APPLY_GATE_VERSION,
  applyPolicyPostUpgradeApplyGate,
  buildPolicyPostUpgradeApplyGate,
  runPolicyPostUpgradeApplyGate,
  validatePolicyPostUpgradeApplyGate,
};
