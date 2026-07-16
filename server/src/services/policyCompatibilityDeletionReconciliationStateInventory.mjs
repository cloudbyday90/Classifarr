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

const POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION =
  'policy.compatibility_deletion_reconciliation_state_inventory.v1';

const POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS = Object.freeze({
  NO_REQUIRES_MAINTENANCE_STATES: 'no_requires_maintenance_states',
  BLOCKED_BY_REQUIRES_MAINTENANCE_STATES: 'blocked_by_requires_maintenance_states',
  INVALID_INVENTORY: 'invalid_inventory',
});

const POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS = Object.freeze({
  INVALID_REQUIRES_MAINTENANCE_STATE_COUNT: 'invalid_requires_maintenance_state_count',
  REQUIRES_MAINTENANCE_STATES_REMAIN: 'requires_maintenance_states_remain',
  STATUS_MISMATCH: 'status_mismatch',
  RISK_COUNT_MISMATCH: 'risk_count_mismatch',
  UNKNOWN_STATUS: 'unknown_status',
  SIDE_EFFECT_PERFORMED: 'side_effect_performed',
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeNonNegativeInteger(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function buildRisk(riskId, message, metadata = {}) {
  return {
    riskId,
    message,
    ...metadata,
  };
}

function determineStatusId(requiresMaintenanceStateCount) {
  if (requiresMaintenanceStateCount === null) {
    return POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
      .INVALID_INVENTORY;
  }

  if (requiresMaintenanceStateCount > 0) {
    return POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
      .BLOCKED_BY_REQUIRES_MAINTENANCE_STATES;
  }

  return POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS
    .NO_REQUIRES_MAINTENANCE_STATES;
}

function buildPolicyCompatibilityDeletionReconciliationStateInventory({
  requiresMaintenanceStateCount = null,
  generatedAt = null,
} = {}) {
  const normalizedCount = normalizeNonNegativeInteger(requiresMaintenanceStateCount);
  const risks = [
    ...(normalizedCount === null
      ? [buildRisk(
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS
          .INVALID_REQUIRES_MAINTENANCE_STATE_COUNT,
        'Compatibility deletion requires a measured count of unresolved requires-maintenance reconciliation states.'
      )]
      : []),
    ...(normalizedCount > 0
      ? [buildRisk(
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS
          .REQUIRES_MAINTENANCE_STATES_REMAIN,
        'Compatibility deletion is blocked while unresolved requires-maintenance reconciliation states remain.',
        { requiresMaintenanceStateCount: normalizedCount }
      )]
      : []),
  ];
  const inventory = {
    version: POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
    statusId: determineStatusId(normalizedCount),
    hasNoRequiresMaintenanceStates: normalizedCount === 0,
    generatedAt: generatedAt || new Date().toISOString(),
    requiresMaintenanceStateCount: normalizedCount,
    riskCount: risks.length,
    risks,
    collectionPolicy: {
      readsCurrentDatabaseState: true,
      countsOnlyUnresolvedStates: true,
      includesPolicyIds: false,
      includesFailureReasons: false,
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
      stepId: normalizedCount > 0
        ? 'resolve_requires_maintenance_reconciliation_states'
        : 'compatibility_deletion_execution_plan',
      label: normalizedCount > 0
        ? 'Resolve Requires-Maintenance Reconciliation States'
        : 'Compatibility Path Deletion Execution Plan',
      reason: normalizedCount > 0
        ? 'Every requires-maintenance reconciliation state must be resolved before compatibility storage can be removed.'
        : 'No unresolved requires-maintenance reconciliation states remain in current reconciliation state storage.',
    },
  };

  return {
    ...inventory,
    validation: validatePolicyCompatibilityDeletionReconciliationStateInventory(inventory),
  };
}

function validatePolicyCompatibilityDeletionReconciliationStateInventory(inventory = {}) {
  const issues = [];
  const requiresMaintenanceStateCount = normalizeNonNegativeInteger(
    inventory.requiresMaintenanceStateCount
  );

  if (!Object.values(POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS)
    .includes(inventory.statusId)) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS.UNKNOWN_STATUS,
      'Compatibility deletion reconciliation-state inventory status must be known.'
    ));
  }

  if (
    requiresMaintenanceStateCount === null ||
    inventory.statusId !== determineStatusId(requiresMaintenanceStateCount) ||
    inventory.hasNoRequiresMaintenanceStates !== (requiresMaintenanceStateCount === 0)
  ) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS.STATUS_MISMATCH,
      'Compatibility deletion reconciliation-state inventory status must agree with its measured count.'
    ));
  }

  if (inventory.riskCount !== asArray(inventory.risks).length) {
    issues.push(buildRisk(
      POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS.RISK_COUNT_MISMATCH,
      'Compatibility deletion reconciliation-state inventory risk count must match its risk list.'
    ));
  }

  Object.entries(asObject(inventory.sideEffects)).forEach(([key, value]) => {
    if (value === true) {
      issues.push(buildRisk(
        POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS
          .SIDE_EFFECT_PERFORMED,
        `Compatibility deletion reconciliation-state inventory cannot perform side effect "${key}".`
      ));
    }
  });

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function loadPolicyCompatibilityDeletionReconciliationStateInventory(dbClient, {
  generatedAt = null,
} = {}) {
  if (!dbClient || typeof dbClient.query !== 'function') {
    throw new TypeError('A database client with query(text) is required.');
  }

  const result = await dbClient.query(`
    SELECT COUNT(*) FILTER (
      WHERE outcome_state = 'requires_maintenance'
    )::integer AS requires_maintenance_state_count
    FROM policy_native_intent_reconciliation_states
  `);
  const row = asArray(result?.rows)[0] || {};

  return buildPolicyCompatibilityDeletionReconciliationStateInventory({
    requiresMaintenanceStateCount:
      row.requiresMaintenanceStateCount ?? row.requires_maintenance_state_count,
    generatedAt,
  });
}

export {
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_RISK_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_STATUS_IDS,
  POLICY_COMPATIBILITY_DELETION_RECONCILIATION_STATE_INVENTORY_VERSION,
  buildPolicyCompatibilityDeletionReconciliationStateInventory,
  loadPolicyCompatibilityDeletionReconciliationStateInventory,
  validatePolicyCompatibilityDeletionReconciliationStateInventory,
};
