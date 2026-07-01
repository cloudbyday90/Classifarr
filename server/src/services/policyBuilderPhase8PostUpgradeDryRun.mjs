import {
  PHASE8R_MIGRATION_CANDIDATE_STATUS_IDS,
  buildPolicyBuilderPhase8MigrationCandidateReport,
} from './policyBuilderPhase8MigrationCandidateReport.mjs';
import {
  PHASE8R_CONVERSION_ACTOR_SOURCE_IDS,
  buildPolicyBuilderPhase8ExplicitConversionWorkflow,
} from './policyBuilderPhase8ExplicitConversionWorkflow.mjs';

const PHASE8R_POST_UPGRADE_DRY_RUN_VERSION = 'phase8r.post_upgrade_dry_run.v1';
const MAX_POST_UPGRADE_DRY_RUN_POLICIES = 100;
const MAX_OPERATOR_ERROR_IDS = 12;
const DRY_RUN_CURRENT_WINDOW_MINUTES = 15;

const PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS = Object.freeze({
  READY_FOR_APPLY_GATE: 'ready_for_apply_gate',
  REVIEW_REQUIRED: 'review_required',
  NO_POLICIES_FOUND: 'no_policies_found',
  INVALID_DRY_RUN: 'invalid_dry_run',
});

const PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS = Object.freeze({
  NO_POLICIES_FOUND: 'no_policies_found',
  NO_READY_CANDIDATES: 'no_ready_candidates',
  CANDIDATE_REPORT_INVALID: 'candidate_report_invalid',
  CONVERSION_WORKFLOW_INVALID: 'conversion_workflow_invalid',
  OPERATOR_REVIEW_REQUIRED: 'operator_review_required',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePolicyLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAX_POST_UPGRADE_DRY_RUN_POLICIES;
  return Math.max(1, Math.min(Math.trunc(numeric), MAX_POST_UPGRADE_DRY_RUN_POLICIES));
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function addMinutes(timestamp, minutes) {
  const date = new Date(timestamp);
  date.setUTCMinutes(date.getUTCMinutes() + minutes);
  return date.toISOString();
}

function parseJsonValue(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePolicyRow(row = {}) {
  const presets = parseJsonValue(row.presets, []);

  return {
    ...row,
    presets: asArray(presets),
    routingTarget: {
      arr_type: row.arr_type ?? null,
      arr_config_id: row.arr_config_id ?? null,
      arr_root_folder_path: row.arr_root_folder_path ?? null,
    },
    libraryMapping: {
      library_id: row.library_id ?? null,
      arr_type: row.arr_type ?? null,
      arr_config_id: row.arr_config_id ?? null,
      arr_root_folder_id: row.arr_root_folder_id ?? null,
      arr_root_folder_path: row.arr_root_folder_path ?? null,
      quality_profile_id: row.arr_quality_profile_id ?? null,
    },
    profileFreshness: {
      state: row.profile_freshness_state || 'fresh_or_unknown',
      stale: row.profile_stale === true,
      lastObservedAt: row.profile_last_observed_at ?? null,
    },
  };
}

async function loadPolicyBuilderPhase8PostUpgradePolicies({
  dbClient,
  maxPolicies = MAX_POST_UPGRADE_DRY_RUN_POLICIES,
} = {}) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('dbClient with query(sql, params) is required');
  }

  const normalizedMaxPolicies = normalizePolicyLimit(maxPolicies);
  const result = await dbClient.query(`
    SELECT
      lp.*,
      l.name AS library_name,
      l.media_type AS library_media_type,
      lam.arr_type,
      lam.arr_config_id,
      lam.arr_root_folder_id,
      lam.arr_root_folder_path,
      lam.quality_profile_id AS arr_quality_profile_id,
      COALESCE(pa.presets, '[]'::jsonb) AS presets
    FROM library_policies lp
    LEFT JOIN libraries l ON l.id = lp.library_id
    LEFT JOIN LATERAL (
      SELECT
        mapping.arr_type,
        mapping.arr_config_id,
        mapping.arr_root_folder_id,
        mapping.arr_root_folder_path,
        mapping.quality_profile_id
      FROM library_arr_mappings mapping
      WHERE mapping.library_id = lp.library_id
      ORDER BY mapping.id
      LIMIT 1
    ) lam ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', cp.id,
          'preset_id', cp.id,
          'key', cp.key,
          'name', cp.name,
          'description', cp.description,
          'icon', cp.icon,
          'category', cp.category,
          'signals', cp.signals,
          'is_system', cp.is_system,
          'source', CASE WHEN cp.is_system = false THEN 'custom' ELSE 'builtin' END,
          'weight', pp.weight,
          'custom_signals', pp.custom_signals,
          'sort_order', pp.sort_order
        )
        ORDER BY pp.sort_order, cp.display_order, cp.name
      ) AS presets
      FROM policy_presets pp
      JOIN content_presets cp ON cp.id = pp.preset_id
      WHERE pp.policy_id = lp.id
    ) pa ON true
    ORDER BY l.name NULLS LAST, lp.priority DESC, lp.sort_order ASC, lp.id ASC
    LIMIT $1
  `, [normalizedMaxPolicies + 1]);

  return asArray(result.rows).map(normalizePolicyRow);
}

function getReadyPolicyIds(candidateReport = {}) {
  return asArray(candidateReport.candidates)
    .filter(candidate =>
      candidate.statusId === PHASE8R_MIGRATION_CANDIDATE_STATUS_IDS.READY_TO_CONVERT &&
      candidate.canConvert === true
    )
    .map(candidate => candidate.policyId)
    .filter(policyId => policyId !== null && policyId !== undefined);
}

function buildOperatorErrorIds({ candidateReport, conversionWorkflow }) {
  const errorIds = [];

  if (candidateReport?.summary?.totalPolicyCount === 0) {
    errorIds.push(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.NO_POLICIES_FOUND);
  }

  if (candidateReport?.validation?.ok !== true) {
    errorIds.push(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.CANDIDATE_REPORT_INVALID);
  }

  if ((candidateReport?.summary?.convertibleCount ?? 0) === 0 && candidateReport?.summary?.totalPolicyCount > 0) {
    errorIds.push(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.NO_READY_CANDIDATES);
  }

  if ((candidateReport?.summary?.reviewRequiredCount ?? 0) > 0) {
    errorIds.push(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.OPERATOR_REVIEW_REQUIRED);
  }

  if (conversionWorkflow && conversionWorkflow.validation?.ok !== true) {
    errorIds.push(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.CONVERSION_WORKFLOW_INVALID);
  }

  return [...new Set(errorIds)].slice(0, MAX_OPERATOR_ERROR_IDS);
}

function determineStatusId({ candidateReport, conversionWorkflow, operatorErrorIds }) {
  if (
    operatorErrorIds.includes(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.CANDIDATE_REPORT_INVALID) ||
    operatorErrorIds.includes(PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS.CONVERSION_WORKFLOW_INVALID)
  ) {
    return PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.INVALID_DRY_RUN;
  }

  if (candidateReport?.summary?.totalPolicyCount === 0) {
    return PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.NO_POLICIES_FOUND;
  }

  if (conversionWorkflow?.summary?.readyToApplyCount > 0) {
    return PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.READY_FOR_APPLY_GATE;
  }

  return PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS.REVIEW_REQUIRED;
}

function buildPolicyBuilderPhase8PostUpgradeDryRun({
  policies = [],
  candidateReport = null,
  maxPolicies = MAX_POST_UPGRADE_DRY_RUN_POLICIES,
  now = null,
} = {}) {
  const normalizedMaxPolicies = normalizePolicyLimit(maxPolicies);
  const generatedAt = normalizeTimestamp(now);
  const report = candidateReport || buildPolicyBuilderPhase8MigrationCandidateReport({
    policies,
    maxPolicies: normalizedMaxPolicies,
  });
  const readyPolicyIds = getReadyPolicyIds(report);
  const conversionWorkflow = readyPolicyIds.length > 0
    ? buildPolicyBuilderPhase8ExplicitConversionWorkflow({
      policies,
      candidateReport: report,
      selectedPolicyIds: readyPolicyIds,
      action: {
        actorSourceId: PHASE8R_CONVERSION_ACTOR_SOURCE_IDS.POST_UPGRADE_APPLY,
        reasonCode: 'phase8r_post_upgrade_dry_run',
        requestedAt: now,
      },
      now,
    })
    : null;
  const operatorErrorIds = buildOperatorErrorIds({
    candidateReport: report,
    conversionWorkflow,
  });
  const statusId = determineStatusId({
    candidateReport: report,
    conversionWorkflow,
    operatorErrorIds,
  });
  const dryRun = {
    version: PHASE8R_POST_UPGRADE_DRY_RUN_VERSION,
    mode: 'dry_run',
    generatedAt,
    expiresAt: addMinutes(generatedAt, DRY_RUN_CURRENT_WINDOW_MINUTES),
    statusId,
    candidateReport: report,
    conversionWorkflow,
    selectedPolicyIds: readyPolicyIds,
    operatorErrorIds,
    summary: {
      totalPolicyCount: report.summary?.totalPolicyCount ?? 0,
      emittedPolicyCount: report.bounded?.emittedPolicyCount ?? 0,
      sourcePolicyCount: report.bounded?.sourcePolicyCount ?? asArray(policies).length,
      convertibleCount: report.summary?.convertibleCount ?? 0,
      reviewRequiredCount: report.summary?.reviewRequiredCount ?? 0,
      readyToApplyCount: conversionWorkflow?.summary?.readyToApplyCount ?? 0,
      blockedCount: conversionWorkflow?.summary?.blockedCount ?? 0,
      alreadyConvertedCount: conversionWorkflow?.summary?.alreadyConvertedCount ?? 0,
      truncated: report.bounded?.truncated === true,
    },
    sideEffects: {
      policyStorageMutated: false,
      nativeRowsInserted: false,
      migrationEventsWritten: false,
      rollbackSnapshotsWritten: false,
      legacyPathsDeleted: false,
      postUpgradeApplied: false,
    },
    nextPhase: {
      phaseId: '8r_12',
      label: 'Post-Upgrade Apply Gate',
      reason: 'Dry-run reporting is wired; the next step is an explicit apply gate with transaction rollback and operator-facing failure states.',
    },
  };

  return {
    ...dryRun,
    validation: validatePolicyBuilderPhase8PostUpgradeDryRun(dryRun),
  };
}

function validatePolicyBuilderPhase8PostUpgradeDryRun(dryRun = {}) {
  const issues = [];
  const sideEffects = asObject(dryRun.sideEffects);

  if (dryRun.mode !== 'dry_run') {
    issues.push({
      riskId: 'post_upgrade_dry_run_not_dry_run',
      message: 'Phase 8R post-upgrade wiring must run in dry-run mode before apply is enabled.',
    });
  }

  if (dryRun.candidateReport?.validation?.ok !== true) {
    issues.push({
      riskId: 'candidate_report_invalid',
      message: 'Post-upgrade dry-run requires a valid migration candidate report.',
      details: dryRun.candidateReport?.validation?.issues || [],
    });
  }

  if (
    dryRun.conversionWorkflow &&
    dryRun.conversionWorkflow.validation?.ok !== true
  ) {
    issues.push({
      riskId: 'conversion_workflow_invalid',
      message: 'Post-upgrade dry-run conversion plan must pass explicit workflow validation.',
      details: dryRun.conversionWorkflow.validation?.issues || [],
    });
  }

  if (dryRun.conversionWorkflow?.mode && dryRun.conversionWorkflow.mode !== 'plan_only') {
    issues.push({
      riskId: 'conversion_workflow_not_plan_only',
      message: 'Post-upgrade dry-run may only produce a plan-only workflow.',
    });
  }

  Object.entries(sideEffects).forEach(([key, value]) => {
    if (value === true) {
      issues.push({
        riskId: 'post_upgrade_dry_run_side_effect',
        message: `Post-upgrade dry-run cannot perform side effect "${key}".`,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function runPolicyBuilderPhase8PostUpgradeDryRun({
  dbClient,
  maxPolicies = MAX_POST_UPGRADE_DRY_RUN_POLICIES,
  now = null,
} = {}) {
  const policies = await loadPolicyBuilderPhase8PostUpgradePolicies({
    dbClient,
    maxPolicies,
  });

  return buildPolicyBuilderPhase8PostUpgradeDryRun({
    policies,
    maxPolicies,
    now,
  });
}

export {
  DRY_RUN_CURRENT_WINDOW_MINUTES,
  MAX_POST_UPGRADE_DRY_RUN_POLICIES,
  PHASE8R_POST_UPGRADE_DRY_RUN_OPERATOR_ERROR_IDS,
  PHASE8R_POST_UPGRADE_DRY_RUN_STATUS_IDS,
  PHASE8R_POST_UPGRADE_DRY_RUN_VERSION,
  buildPolicyBuilderPhase8PostUpgradeDryRun,
  loadPolicyBuilderPhase8PostUpgradePolicies,
  runPolicyBuilderPhase8PostUpgradeDryRun,
  validatePolicyBuilderPhase8PostUpgradeDryRun,
};
