/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION =
  'policy.compatibility_deletion_current_inventory.v1';

const POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS = Object.freeze({
  ALL_ENABLED_POLICIES_NATIVE: 'all_enabled_policies_native',
  BLOCKED_BY_UNCONVERTED_POLICIES: 'blocked_by_unconverted_policies',
  INVALID_INVENTORY: 'invalid_inventory',
});

const POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS = Object.freeze({
  INVALID_POLICY_ROW: 'invalid_policy_row',
  MISSING_ACTIVE_INTENT: 'missing_active_intent',
  AMBIGUOUS_ACTIVE_INTENT: 'ambiguous_active_intent',
  NON_AUTHORITATIVE_ACTIVE_INTENT: 'non_authoritative_active_intent',
  POLICY_COUNT_MISMATCH: 'policy_count_mismatch',
  STATUS_MISMATCH: 'status_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

const SAFE_VALIDATION_STATUSES = new Set(['valid', 'warning']);
const MAX_SAMPLE_POLICY_IDS = 20;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function normalizePositiveInteger(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeStringArray(value) {
  return [...new Set(asArray(value)
    .map(entry => String(entry || '').trim().toLowerCase())
    .filter(Boolean))].sort();
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function normalizePolicyRow(row = {}) {
  const value = asObject(row);
  const policyId = normalizePositiveInteger(value.policyId ?? value.policy_id);
  const activeIntentCount = normalizeNonNegativeInteger(
    value.activeIntentCount ?? value.active_intent_count
  );
  const authoritativeNativeIntentCount = normalizeNonNegativeInteger(
    value.authoritativeNativeIntentCount ?? value.authoritative_native_intent_count
  );

  if (
    !policyId ||
    activeIntentCount === null ||
    authoritativeNativeIntentCount === null ||
    authoritativeNativeIntentCount > activeIntentCount
  ) {
    return null;
  }

  return {
    policyId,
    activeIntentCount,
    authoritativeNativeIntentCount,
    activeIntentSources: normalizeStringArray(
      value.activeIntentSources ?? value.active_intent_sources
    ),
    activeIntentValidationStatuses: normalizeStringArray(
      value.activeIntentValidationStatuses ?? value.active_intent_validation_statuses
    ),
  };
}

function hasAuthoritativeNativeIntent(policy = {}) {
  return policy.activeIntentCount === 1 &&
    policy.authoritativeNativeIntentCount === 1 &&
    policy.activeIntentSources.length === 1 &&
    policy.activeIntentSources[0] === 'native_intent' &&
    policy.activeIntentValidationStatuses.length === 1 &&
    SAFE_VALIDATION_STATUSES.has(policy.activeIntentValidationStatuses[0]);
}

function getPolicyState(policy = {}) {
  if (hasAuthoritativeNativeIntent(policy)) {
    return 'native_authoritative';
  }

  if (policy.activeIntentCount === 0) {
    return 'missing_active_intent';
  }

  if (policy.activeIntentCount > 1) {
    return 'ambiguous_active_intent';
  }

  return 'non_authoritative_active_intent';
}

function summarizePolicyIds(policies = []) {
  return policies
    .map(policy => policy.policyId)
    .sort((left, right) => left - right)
    .slice(0, MAX_SAMPLE_POLICY_IDS);
}

function buildConversionRisks(policyStates = []) {
  const risks = [];
  const stateRiskDefinitions = [
    {
      stateId: 'missing_active_intent',
      riskId: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.MISSING_ACTIVE_INTENT,
      message: 'Enabled policies without an active native intent must be converted before compatibility deletion planning.',
    },
    {
      stateId: 'ambiguous_active_intent',
      riskId: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.AMBIGUOUS_ACTIVE_INTENT,
      message: 'Enabled policies with multiple active intents must resolve authority before compatibility deletion planning.',
    },
    {
      stateId: 'non_authoritative_active_intent',
      riskId: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.NON_AUTHORITATIVE_ACTIVE_INTENT,
      message: 'Enabled policies need one valid native intent before compatibility deletion planning.',
    },
  ];

  stateRiskDefinitions.forEach(({ stateId, riskId, message }) => {
    const policies = policyStates.filter(policy => policy.stateId === stateId);
    if (policies.length > 0) {
      risks.push(buildRisk(riskId, message, {
        policyCount: policies.length,
        samplePolicyIds: summarizePolicyIds(policies),
      }));
    }
  });

  return risks;
}

function determineStatusId({ invalidRowCount, unconvertedPolicyCount }) {
  if (invalidRowCount > 0) {
    return POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS.INVALID_INVENTORY;
  }

  if (unconvertedPolicyCount > 0) {
    return POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
      .BLOCKED_BY_UNCONVERTED_POLICIES;
  }

  return POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS
    .ALL_ENABLED_POLICIES_NATIVE;
}

function buildPolicyCompatibilityDeletionCurrentInventory({
  policyRows = [],
  generatedAt = null,
} = {}) {
  const sourceRows = asArray(policyRows);
  const normalizedPolicies = sourceRows.map(normalizePolicyRow);
  const invalidRowCount = normalizedPolicies.filter(policy => !policy).length;
  const policyStates = normalizedPolicies
    .filter(Boolean)
    .map(policy => ({
      policyId: policy.policyId,
      stateId: getPolicyState(policy),
    }));
  const nativeAuthoritativePolicyCount = policyStates
    .filter(policy => policy.stateId === 'native_authoritative').length;
  const missingActiveIntentPolicyCount = policyStates
    .filter(policy => policy.stateId === 'missing_active_intent').length;
  const ambiguousActiveIntentPolicyCount = policyStates
    .filter(policy => policy.stateId === 'ambiguous_active_intent').length;
  const nonAuthoritativeActiveIntentPolicyCount = policyStates
    .filter(policy => policy.stateId === 'non_authoritative_active_intent').length;
  const enabledPolicyCount = policyStates.length;
  const unconvertedPolicyCount = enabledPolicyCount - nativeAuthoritativePolicyCount;
  const risks = [
    ...(invalidRowCount > 0
      ? [buildRisk(
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.INVALID_POLICY_ROW,
        'Current policy inventory contains malformed enabled-policy evidence.',
        { invalidRowCount }
      )]
      : []),
    ...buildConversionRisks(policyStates),
  ];
  const inventory = {
    version: POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
    statusId: determineStatusId({ invalidRowCount, unconvertedPolicyCount }),
    allEnabledPoliciesNative: invalidRowCount === 0 && unconvertedPolicyCount === 0,
    generatedAt: generatedAt || new Date().toISOString(),
    policyCounts: {
      enabledPolicyCount,
      nativeAuthoritativePolicyCount,
      unconvertedPolicyCount,
      missingActiveIntentPolicyCount,
      ambiguousActiveIntentPolicyCount,
      nonAuthoritativeActiveIntentPolicyCount,
      invalidRowCount,
    },
    policyStates,
    riskCount: risks.length,
    risks,
    collectionPolicy: {
      readsCurrentDatabaseState: true,
      includesPolicyPayloads: false,
      includesLibraryNames: false,
      writesDatabase: false,
      deletesData: false,
    },
    sideEffects: {
      writesDatabase: false,
      writesFiles: false,
      mutatesSchema: false,
      deletesData: false,
    },
    nextStep: {
      stepId: unconvertedPolicyCount > 0
        ? 'convert_enabled_policies_to_native_intent'
        : 'compatibility_deletion_execution_plan',
      label: unconvertedPolicyCount > 0
        ? 'Convert Enabled Policies To Native Intent'
        : 'Compatibility Path Deletion Execution Plan',
      reason: unconvertedPolicyCount > 0
        ? 'Every enabled policy needs one valid active native intent before compatibility paths can be removed.'
        : 'Every enabled policy has one valid active native intent; continue with the separate deletion execution plan gate.',
    },
  };

  return {
    ...inventory,
    validation: validatePolicyCompatibilityDeletionCurrentInventory(inventory),
  };
}

function validatePolicyCompatibilityDeletionCurrentInventory(inventory = {}) {
  const issues = [];
  const policyCounts = asObject(inventory.policyCounts);
  const enabledPolicyCount = normalizeNonNegativeInteger(policyCounts.enabledPolicyCount);
  const nativeAuthoritativePolicyCount = normalizeNonNegativeInteger(
    policyCounts.nativeAuthoritativePolicyCount
  );
  const unconvertedPolicyCount = normalizeNonNegativeInteger(policyCounts.unconvertedPolicyCount);
  const invalidRowCount = normalizeNonNegativeInteger(policyCounts.invalidRowCount);

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS)
    .includes(inventory.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility deletion current inventory status must be known.'
    ));
  }

  if (
    enabledPolicyCount === null ||
    nativeAuthoritativePolicyCount === null ||
    unconvertedPolicyCount === null ||
    nativeAuthoritativePolicyCount + unconvertedPolicyCount !== enabledPolicyCount
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.POLICY_COUNT_MISMATCH,
      'Current policy inventory counts must account for every enabled policy exactly once.'
    ));
  }

  if (
    invalidRowCount === null ||
    inventory.statusId !== determineStatusId({
      invalidRowCount,
      unconvertedPolicyCount: unconvertedPolicyCount ?? 0,
    }) ||
    inventory.allEnabledPoliciesNative !== (
      invalidRowCount === 0 && unconvertedPolicyCount === 0
    )
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.STATUS_MISMATCH,
      'Current policy inventory status and readiness must agree with the measured policy counts.'
    ));
  }

  if (inventory.riskCount !== asArray(inventory.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.RISK_COUNT_MISMATCH,
      'Current policy inventory risk count must match the reported risk list.'
    ));
  }

  Object.entries(asObject(inventory.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS.SIDE_EFFECT_PERFORMED,
        `Compatibility deletion current inventory cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function loadPolicyCompatibilityDeletionCurrentInventory(dbClient, {
  generatedAt = null,
} = {}) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const result = await dbClient.query(`
    WITH active_intents AS (
      SELECT
        intent.id,
        intent.policy_id,
        intent.source,
        COALESCE(validation.status, intent.validation_status) AS validation_status,
        COALESCE(validation.error_count, 0) AS error_count
      FROM policy_intents AS intent
      LEFT JOIN LATERAL (
        SELECT status, error_count
        FROM policy_intent_validation_status
        WHERE intent_id = intent.id
        ORDER BY validated_at DESC, id DESC
        LIMIT 1
      ) AS validation ON TRUE
      WHERE intent.active = TRUE
    )
    SELECT
      policy.id AS policy_id,
      COUNT(intent.id)::integer AS active_intent_count,
      COUNT(intent.id) FILTER (
        WHERE intent.source = 'native_intent'
          AND intent.validation_status IN ('valid', 'warning')
          AND intent.error_count = 0
      )::integer AS authoritative_native_intent_count,
      COALESCE(
        ARRAY_AGG(DISTINCT intent.source) FILTER (WHERE intent.id IS NOT NULL),
        ARRAY[]::text[]
      ) AS active_intent_sources,
      COALESCE(
        ARRAY_AGG(DISTINCT intent.validation_status) FILTER (WHERE intent.id IS NOT NULL),
        ARRAY[]::text[]
      ) AS active_intent_validation_statuses
    FROM library_policies AS policy
    LEFT JOIN active_intents AS intent ON intent.policy_id = policy.id
    WHERE policy.enabled = TRUE
    GROUP BY policy.id
    ORDER BY policy.id ASC
  `);

  return buildPolicyCompatibilityDeletionCurrentInventory({
    policyRows: result.rows,
    generatedAt,
  });
}

export {
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_CURRENT_INVENTORY_VERSION,
  buildPolicyCompatibilityDeletionCurrentInventory,
  loadPolicyCompatibilityDeletionCurrentInventory,
  validatePolicyCompatibilityDeletionCurrentInventory,
};
