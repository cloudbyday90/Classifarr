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

import {
  buildPolicyProductionNamingRegressionAudit,
} from '../../server/src/services/policyProductionNamingRegressionAudit.mjs';

const POLICY_PRODUCTION_NAMING_GATE_VERSION =
  'policy.production_naming_gate.v1';

const POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS = Object.freeze({
  COMPLETE: 'complete',
  BLOCKED: 'blocked',
});

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildPolicyProductionNamingGate({
  inventory,
  baseline,
  generatedAt = new Date().toISOString(),
} = {}) {
  const regressionAudit = buildPolicyProductionNamingRegressionAudit({
    inventory,
    baseline,
  });
  const inventorySummary = asObject(inventory?.summary);
  const complete = regressionAudit.ok === true;

  return {
    version: POLICY_PRODUCTION_NAMING_GATE_VERSION,
    generatedAt,
    statusId: complete
      ? POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS.COMPLETE
      : POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS.BLOCKED,
    complete,
    inventory: {
      version: inventory?.version || null,
      validation: asObject(inventory?.validation),
      summary: inventorySummary,
    },
    regressionAudit,
    riskCount: regressionAudit.riskCount,
    risks: regressionAudit.risks,
    sideEffects: {
      filesRead: inventory?.sideEffects?.filesRead === true,
      filesWritten: false,
      storageChanged: false,
      gitCommandsRun: false,
      commandsExecuted: false,
    },
    nextAction: regressionAudit.nextAction,
  };
}

export {
  POLICY_PRODUCTION_NAMING_GATE_STATUS_IDS,
  POLICY_PRODUCTION_NAMING_GATE_VERSION,
  buildPolicyProductionNamingGate,
};
