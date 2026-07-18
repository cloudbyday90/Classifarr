/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS = Object.freeze({
  CIRCUIT_OPEN: 'circuit_open',
  PROLONGED_UNRESOLVED_INVENTORY: 'prolonged_unresolved_inventory',
  REPEATED_SYSTEM_FAILURE: 'repeated_system_failure',
});

export const NATIVE_INTENT_RECONCILIATION_ALERT_STATE_IDS = Object.freeze({
  FIRING: 'firing',
  RESOLVED: 'resolved',
});

export const NATIVE_INTENT_RECONCILIATION_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const NATIVE_INTENT_RECONCILIATION_PROLONGED_UNRESOLVED_MS = 24 * 60 * 60 * 1000;
export const NATIVE_INTENT_RECONCILIATION_REPEATED_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const NATIVE_INTENT_RECONCILIATION_REPEATED_FAILURE_THRESHOLD = 3;

const ALERT_DEFINITIONS = Object.freeze({
  [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.CIRCUIT_OPEN]: {
    reasonId: 'reconciliation_circuit_open',
    notificationType: 'error',
    title: 'Automatic policy reconciliation is paused',
    message: 'Automatic policy reconciliation paused after repeated system failures. Review the reconciliation status before resetting automation.',
  },
  [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.PROLONGED_UNRESOLVED_INVENTORY]: {
    reasonId: 'reconciliation_unresolved_inventory_prolonged',
    notificationType: 'warning',
    title: 'Policy reconciliation needs attention',
    message: 'Some policies have remained unresolved for at least one day. Review the reconciliation status to determine whether a supported resolution is available.',
  },
  [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.REPEATED_SYSTEM_FAILURE]: {
    reasonId: 'reconciliation_repeated_system_failure',
    notificationType: 'error',
    title: 'Policy reconciliation is failing repeatedly',
    message: 'Automatic policy reconciliation has failed repeatedly. Review the reconciliation status for the latest safe failure category and run correlation.',
  },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function normalizeAlertState(value = {}) {
  const source = asObject(value);
  const alertTypeId = typeof (source.alertTypeId ?? source.alert_type_id) === 'string'
    ? (source.alertTypeId ?? source.alert_type_id).trim()
    : null;
  if (!Object.hasOwn(ALERT_DEFINITIONS, alertTypeId)) return null;

  return {
    alertTypeId,
    alertState: source.alertState ?? source.alert_state,
    lastNotifiedAt: normalizeTimestamp(source.lastNotifiedAt ?? source.last_notified_at),
  };
}

function hasElapsedCooldown({ previousAlert, evaluatedAt }) {
  if (!previousAlert?.lastNotifiedAt) return true;
  const lastNotifiedAt = new Date(previousAlert.lastNotifiedAt).getTime();
  const now = new Date(evaluatedAt).getTime();
  return !Number.isFinite(lastNotifiedAt) || !Number.isFinite(now) ||
    now - lastNotifiedAt >= NATIVE_INTENT_RECONCILIATION_ALERT_COOLDOWN_MS;
}

function buildAlertEvaluation({ alertTypeId, firing, previousAlert, evaluatedAt }) {
  const definition = ALERT_DEFINITIONS[alertTypeId];
  const alertState = firing
    ? NATIVE_INTENT_RECONCILIATION_ALERT_STATE_IDS.FIRING
    : NATIVE_INTENT_RECONCILIATION_ALERT_STATE_IDS.RESOLVED;
  const notificationDue = firing && (
    previousAlert?.alertState !== NATIVE_INTENT_RECONCILIATION_ALERT_STATE_IDS.FIRING ||
    hasElapsedCooldown({ previousAlert, evaluatedAt })
  );
  const cooldownUntil = previousAlert?.lastNotifiedAt && !notificationDue
    ? new Date(
      new Date(previousAlert.lastNotifiedAt).getTime() + NATIVE_INTENT_RECONCILIATION_ALERT_COOLDOWN_MS,
    ).toISOString()
    : null;

  return {
    alertTypeId,
    alertState,
    reasonId: definition.reasonId,
    notificationType: definition.notificationType,
    notificationDue,
    notificationCooldownUntil: cooldownUntil,
    title: definition.title,
    message: definition.message,
    rawPayloadExposed: false,
  };
}

export function buildNativeIntentReconciliationAlertEvaluation({
  status = {},
  priorAlertStates = [],
  evaluatedAt = new Date(),
} = {}) {
  const normalizedEvaluatedAt = normalizeTimestamp(evaluatedAt) || new Date().toISOString();
  const priorByType = new Map(asArray(priorAlertStates)
    .map(normalizeAlertState)
    .filter(Boolean)
    .map(alert => [alert.alertTypeId, alert]));
  const source = asObject(status);
  const control = asObject(source.control);
  const inventory = asObject(source.inventory);
  const oldestUnresolvedAt = normalizeTimestamp(inventory.oldestUnresolvedAt);
  const unresolvedAgeMs = oldestUnresolvedAt
    ? new Date(normalizedEvaluatedAt).getTime() - new Date(oldestUnresolvedAt).getTime()
    : 0;
  const unresolvedCount = Number(inventory.unresolvedCount) || 0;
  const recentFailedRunCount = Number(source.recentFailedRunCount) || 0;

  const firingByType = {
    [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.CIRCUIT_OPEN]:
      control.automationEnabled !== false && control.circuitState === 'open',
    [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.PROLONGED_UNRESOLVED_INVENTORY]:
      unresolvedCount > 0 && unresolvedAgeMs >= NATIVE_INTENT_RECONCILIATION_PROLONGED_UNRESOLVED_MS,
    [NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS.REPEATED_SYSTEM_FAILURE]:
      recentFailedRunCount >= NATIVE_INTENT_RECONCILIATION_REPEATED_FAILURE_THRESHOLD,
  };

  return Object.values(NATIVE_INTENT_RECONCILIATION_ALERT_TYPE_IDS)
    .map(alertTypeId => buildAlertEvaluation({
      alertTypeId,
      firing: firingByType[alertTypeId] === true,
      previousAlert: priorByType.get(alertTypeId),
      evaluatedAt: normalizedEvaluatedAt,
    }));
}
