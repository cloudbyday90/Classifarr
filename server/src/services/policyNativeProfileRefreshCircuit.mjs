/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  isPolicyNativeProfileRefreshCircuitFailureCode,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_COALESCED_PROBE_DELAY_MS,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_CONFIGURATION_FAILURE_CODE,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_FAILURE_THRESHOLD,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS,
  POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
} from './policyNativeProfileRefreshCircuitVocabulary.mjs';

const MAX_SOURCE_EVENT_ID_LENGTH = 160;

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeDate(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeBaseSourceEventId(value) {
  const sourceEventId = typeof value === 'string' ? value.trim() : '';
  return sourceEventId &&
    sourceEventId.length <= MAX_SOURCE_EVENT_ID_LENGTH &&
    !sourceEventId.includes(':retry:')
    ? sourceEventId
    : null;
}

function normalizeFailureCount(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) return 0;
  return Math.min(numeric, POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_FAILURE_THRESHOLD);
}

function normalizeCircuitState(value) {
  return Object.values(POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS).includes(value)
    ? value
    : null;
}

function normalizePolicyNativeProfileRefreshCircuit(row = null) {
  if (!row || typeof row !== 'object') return null;

  const circuitState = normalizeCircuitState(row.circuitState ?? row.circuit_state);
  const consecutiveFailureCount = normalizeFailureCount(
    row.consecutiveFailureCount ?? row.consecutive_failure_count,
  );
  const lastTerminalOutboxId = normalizePositiveInteger(
    row.lastTerminalOutboxId ?? row.last_terminal_outbox_id,
  );
  const lastFailureCode = typeof (row.lastFailureCode ?? row.last_failure_code) === 'string'
    ? (row.lastFailureCode ?? row.last_failure_code).trim()
    : null;
  const openedAt = normalizeDate(row.openedAt ?? row.opened_at);
  const nextProbeAt = normalizeDate(row.nextProbeAt ?? row.next_probe_at);
  const probeOutboxId = normalizePositiveInteger(row.probeOutboxId ?? row.probe_outbox_id);

  const emptyState = consecutiveFailureCount === 0 && !lastTerminalOutboxId && !lastFailureCode;
  const closedState = circuitState === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.CLOSED &&
    !openedAt && !nextProbeAt && !probeOutboxId;
  const openState = circuitState === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN &&
    Boolean(openedAt && nextProbeAt) && !probeOutboxId;
  const halfOpenState = circuitState === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.HALF_OPEN &&
    Boolean(openedAt && probeOutboxId) && !nextProbeAt;
  const failureState = consecutiveFailureCount > 0 && Boolean(lastTerminalOutboxId && lastFailureCode);

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
    valid: Boolean(circuitState && (emptyState || failureState) && (closedState || openState || halfOpenState)),
    circuitState: circuitState || POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN,
    consecutiveFailureCount,
    lastTerminalOutboxId,
    lastFailureCode,
    openedAt,
    nextProbeAt,
    probeOutboxId,
  };
}

function buildCircuitDecision({ circuit, now = new Date() } = {}) {
  const normalizedCircuit = normalizePolicyNativeProfileRefreshCircuit(circuit);
  const evaluatedAt = normalizeDate(now);

  if (!normalizedCircuit) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      actionId: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PRIMARY,
      reasonCodes: ['native_profile_refresh_circuit_absent'],
    };
  }
  if (!normalizedCircuit.valid || !evaluatedAt) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      actionId: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.BLOCK,
      reasonCodes: ['native_profile_refresh_circuit_invalid'],
    };
  }
  if (normalizedCircuit.circuitState === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.CLOSED) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      actionId: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PRIMARY,
      reasonCodes: ['native_profile_refresh_circuit_closed'],
    };
  }
  if (
    normalizedCircuit.circuitState === POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN &&
    Date.parse(normalizedCircuit.nextProbeAt) <= Date.parse(evaluatedAt)
  ) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      actionId: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PROBE,
      reasonCodes: ['native_profile_refresh_circuit_probe_due'],
    };
  }

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
    actionId: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.BLOCK,
    reasonCodes: [normalizedCircuit.circuitState ===
      POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.HALF_OPEN
      ? 'native_profile_refresh_circuit_probe_in_progress'
      : 'native_profile_refresh_circuit_open'],
  };
}

function buildPolicyNativeProfileRefreshCircuitFailureTransition({
  circuit,
  failedOutboxId,
  failureCount,
  failureCode,
  now = new Date(),
} = {}) {
  const normalizedCircuit = normalizePolicyNativeProfileRefreshCircuit(circuit);
  const normalizedFailedOutboxId = normalizePositiveInteger(failedOutboxId);
  const normalizedFailureCode = typeof failureCode === 'string' ? failureCode.trim() : '';
  const evaluatedAt = normalizeDate(now);

  if (!normalizedFailedOutboxId || !evaluatedAt ||
      !isPolicyNativeProfileRefreshCircuitFailureCode(normalizedFailureCode)) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      ready: false,
      changed: false,
      opened: false,
      reasonCodes: ['invalid_native_profile_refresh_circuit_failure'],
      circuit: normalizedCircuit,
    };
  }
  if (normalizedCircuit?.lastTerminalOutboxId === normalizedFailedOutboxId) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      ready: true,
      changed: false,
      opened: false,
      reasonCodes: ['native_profile_refresh_circuit_failure_already_recorded'],
      circuit: normalizedCircuit,
    };
  }

  const observedFailureCount = Math.max(1, normalizeFailureCount(failureCount));
  const configurationFailure = normalizedFailureCode ===
    POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_CONFIGURATION_FAILURE_CODE;
  const halfOpenFailure = normalizedCircuit?.circuitState ===
    POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.HALF_OPEN;
  const opensCircuit = configurationFailure ||
    halfOpenFailure ||
    observedFailureCount >= POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_FAILURE_THRESHOLD;
  const circuitState = opensCircuit
    ? POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN
    : POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.CLOSED;
  const nextProbeAt = opensCircuit
    ? new Date(Date.parse(evaluatedAt) + POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_PROBE_DELAY_MS)
      .toISOString()
    : null;

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
    ready: true,
    changed: true,
    opened: opensCircuit && normalizedCircuit?.circuitState !==
      POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.OPEN,
    reasonCodes: opensCircuit
      ? ['native_profile_refresh_circuit_opened']
      : ['native_profile_refresh_circuit_failure_recorded'],
    circuit: {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      valid: true,
      circuitState,
      consecutiveFailureCount: observedFailureCount,
      lastTerminalOutboxId: normalizedFailedOutboxId,
      lastFailureCode: normalizedFailureCode,
      openedAt: opensCircuit ? evaluatedAt : null,
      nextProbeAt,
      probeOutboxId: null,
    },
  };
}

function buildPolicyNativeProfileRefreshCircuitProbeTransition({
  circuit,
  probeOutboxId,
  now = new Date(),
} = {}) {
  const normalizedCircuit = normalizePolicyNativeProfileRefreshCircuit(circuit);
  const normalizedProbeOutboxId = normalizePositiveInteger(probeOutboxId);
  const decision = buildCircuitDecision({ circuit: normalizedCircuit, now });

  if (!normalizedCircuit?.valid || !normalizedProbeOutboxId ||
      decision.actionId !== POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PROBE) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      ready: false,
      reasonCodes: ['invalid_native_profile_refresh_circuit_probe'],
      circuit: normalizedCircuit,
    };
  }

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
    ready: true,
    reasonCodes: ['native_profile_refresh_circuit_probe_started'],
    circuit: {
      ...normalizedCircuit,
      circuitState: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_STATE_IDS.HALF_OPEN,
      nextProbeAt: null,
      probeOutboxId: normalizedProbeOutboxId,
    },
  };
}

function buildPolicyNativeProfileRefreshCircuitProbeDeferral({
  circuit,
  now = new Date(),
} = {}) {
  const normalizedCircuit = normalizePolicyNativeProfileRefreshCircuit(circuit);
  const decision = buildCircuitDecision({ circuit: normalizedCircuit, now });
  const evaluatedAt = normalizeDate(now);

  if (!normalizedCircuit?.valid || !evaluatedAt ||
      decision.actionId !== POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_ACTION_IDS.ENQUEUE_PROBE) {
    return {
      version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
      ready: false,
      reasonCodes: ['invalid_native_profile_refresh_circuit_probe_deferral'],
      circuit: normalizedCircuit,
    };
  }

  return {
    version: POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_VERSION,
    ready: true,
    reasonCodes: ['native_profile_refresh_circuit_probe_deferred'],
    circuit: {
      ...normalizedCircuit,
      nextProbeAt: new Date(
        Date.parse(evaluatedAt) + POLICY_NATIVE_PROFILE_REFRESH_CIRCUIT_COALESCED_PROBE_DELAY_MS,
      ).toISOString(),
    },
  };
}

export {
  buildCircuitDecision,
  buildPolicyNativeProfileRefreshCircuitFailureTransition,
  buildPolicyNativeProfileRefreshCircuitProbeDeferral,
  buildPolicyNativeProfileRefreshCircuitProbeTransition,
  normalizeBaseSourceEventId,
  normalizePolicyNativeProfileRefreshCircuit,
};
