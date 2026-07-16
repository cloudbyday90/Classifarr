/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import * as defaultDb from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import {
  loadPolicyActiveIntentIntegrityReport,
  POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS,
} from './policyActiveIntentIntegrity.mjs';
import {
  NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS,
  NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS,
  NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_PROBE_STALE_MS,
  NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS,
  NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS,
  buildSuccessfulEvaluationTransition,
  buildSystemFailureTransition,
  classifyApplyGateSystemFailure,
  classifyErrorFailureCategory,
  normalizeControl,
  normalizeTimestamp,
  validateOperatorAction,
} from './nativeIntentReconciliationControlContract.mjs';
import {
  insertNativeIntentReconciliationControlEvent,
  loadNativeIntentReconciliationControl,
  lockNativeIntentReconciliationControl,
  persistNativeIntentReconciliationControl,
} from './nativeIntentReconciliationControlPersistence.mjs';
import {
  nativeIntentReconciliationLifecycleService as defaultLifecycleService,
} from './nativeIntentReconciliationLifecycleService.mjs';

const logger = createLogger('NativeIntentReconciliationControlService');

function isRecoveryProbeStale(control, now) {
  const probeStartedAt = new Date(control?.recoveryProbeStartedAt || 0).getTime();
  const nowTimestamp = new Date(now).getTime();
  if (!Number.isFinite(probeStartedAt) || !Number.isFinite(nowTimestamp) || probeStartedAt <= 0) {
    return true;
  }

  return nowTimestamp - probeStartedAt >= NATIVE_INTENT_RECONCILIATION_RECOVERY_PROBE_STALE_MS;
}

function buildControlEligibility({ allowed, statusId, reasonId, control }) {
  return {
    allowed,
    statusId,
    reasonId,
    control,
    rawPayloadExposed: false,
  };
}

function toClosedControl(control = {}, recoveredAt) {
  return {
    ...control,
    circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED,
    recoveryRequirement: NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.NONE,
    failureCount: 0,
    failureWindowStartedAt: null,
    lastFailureCategory: null,
    openedAt: null,
    recoveryProbeStartedAt: null,
    recoveredAt,
  };
}

async function defaultRecoveryProbe({ dbClient, lifecycleService }) {
  await dbClient.query('SELECT 1 AS reconciliation_control_probe');
  const [lifecycleEligibility, authorityIntegrity] = await Promise.all([
    lifecycleService.getExecutionEligibility({ dbClient }),
    loadPolicyActiveIntentIntegrityReport(dbClient),
  ]);

  if (lifecycleEligibility?.allowed !== true) {
    return {
      healthy: false,
      reasonId: lifecycleEligibility?.reasonId || 'restore_validation_failed',
      failureCategory: null,
      rawPayloadExposed: false,
    };
  }

  if (authorityIntegrity?.statusId !== POLICY_ACTIVE_INTENT_INTEGRITY_STATUS_IDS.CLEAN) {
    return {
      healthy: false,
      reasonId: 'native_authority_integrity_failed',
      failureCategory:
        NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.NATIVE_AUTHORITY_INTEGRITY_FAILED,
      rawPayloadExposed: false,
    };
  }

  return {
    healthy: true,
    reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.AUTOMATIC_RECOVERY,
    failureCategory: null,
    rawPayloadExposed: false,
  };
}

export class NativeIntentReconciliationControlService {
  constructor({
    db = defaultDb,
    lifecycleService = defaultLifecycleService,
    loggerInstance = logger,
    now = () => new Date(),
    loadControl = loadNativeIntentReconciliationControl,
    lockControl = lockNativeIntentReconciliationControl,
    persistControl = persistNativeIntentReconciliationControl,
    insertEvent = insertNativeIntentReconciliationControlEvent,
    runRecoveryProbe = defaultRecoveryProbe,
  } = {}) {
    this.db = db;
    this.lifecycleService = lifecycleService;
    this.logger = loggerInstance;
    this.now = now;
    this.loadControl = loadControl;
    this.lockControl = lockControl;
    this.persistControl = persistControl;
    this.insertEvent = insertEvent;
    this.runRecoveryProbe = runRecoveryProbe;
  }

  async getStatus({ dbClient = this.db } = {}) {
    return normalizeControl(await this.loadControl({ db: dbClient }));
  }

  async withLockedControl({ dbClient = this.db, work }) {
    if (typeof dbClient?.withTransaction !== 'function') {
      throw new TypeError('Native intent reconciliation control requires a transaction boundary.');
    }

    return dbClient.withTransaction(async client => {
      const control = normalizeControl(await this.lockControl({ client }));
      if (!control.available) {
        throw new Error('Native intent reconciliation control row is unavailable.');
      }
      return work({ client, control });
    });
  }

  async claimRecoveryProbe({ dbClient, now }) {
    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (!control.automationEnabled) {
          return { claimed: false, control };
        }
        if (
          control.circuitState === NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.HALF_OPEN &&
          !isRecoveryProbeStale(control, now)
        ) {
          return { claimed: false, control };
        }
        if (
          ![
            NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN,
            NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.HALF_OPEN,
          ].includes(control.circuitState) ||
          control.recoveryRequirement !==
            NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.HEALTHY_EVALUATION
        ) {
          return { claimed: false, control };
        }

        const persisted = normalizeControl(await this.persistControl({
          client,
          control: {
            ...control,
            circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.HALF_OPEN,
            recoveryProbeStartedAt: now,
          },
        }));
        return { claimed: true, control: persisted };
      },
    });
  }

  async completeRecoveryProbe({ dbClient, probe, now }) {
    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (!control.automationEnabled) return control;
        if (control.circuitState !== NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.HALF_OPEN) {
          return control;
        }

        if (probe?.healthy === true) {
          const persisted = normalizeControl(await this.persistControl({
            client,
            control: toClosedControl(control, now),
          }));
          await this.insertEvent({
            client,
            eventType: NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS.CIRCUIT_RECOVERED,
            reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.AUTOMATIC_RECOVERY,
            actorType: 'system',
            occurredAt: now,
          });
          return persisted;
        }

        const failureCategory = probe?.failureCategory || control.lastFailureCategory;
        const recoveryRequirement = failureCategory ===
          NATIVE_INTENT_RECONCILIATION_SYSTEM_FAILURE_CATEGORY_IDS.NATIVE_AUTHORITY_INTEGRITY_FAILED
          ? NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET
          : control.recoveryRequirement;
        return normalizeControl(await this.persistControl({
          client,
          control: {
            ...control,
            circuitState: NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN,
            recoveryRequirement,
            lastFailureCategory: failureCategory,
            recoveryProbeStartedAt: null,
          },
        }));
      },
    });
  }

  async getExecutionEligibility({ dbClient = this.db, now = this.now() } = {}) {
    const evaluatedAt = normalizeTimestamp(now);
    const control = await this.getStatus({ dbClient });
    if (!control.available) {
      return buildControlEligibility({
        allowed: false,
        statusId: 'deferred_by_reconciliation_control',
        reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.CONTROL_UNAVAILABLE,
        control,
      });
    }
    if (!control.automationEnabled) {
      return buildControlEligibility({
        allowed: false,
        statusId: 'deferred_by_reconciliation_emergency_stop',
        reasonId: control.manualDisabledReasonId ||
          NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.EMERGENCY_STOP,
        control,
      });
    }
    if (control.circuitState === NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED) {
      return buildControlEligibility({
        allowed: true,
        statusId: 'ready',
        reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.STARTUP_READY,
        control,
      });
    }
    if (control.recoveryRequirement === NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET) {
      return buildControlEligibility({
        allowed: false,
        statusId: 'deferred_by_reconciliation_circuit_breaker',
        reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.CIRCUIT_OPEN,
        control,
      });
    }

    const claim = await this.claimRecoveryProbe({ dbClient, now: evaluatedAt });
    if (!claim.claimed) {
      return buildControlEligibility({
        allowed: false,
        statusId: 'deferred_by_reconciliation_circuit_breaker',
        reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.RECOVERY_PROBE_IN_PROGRESS,
        control: claim.control,
      });
    }

    let probe;
    try {
      probe = await this.runRecoveryProbe({
        dbClient,
        lifecycleService: this.lifecycleService,
      });
    } catch (error) {
      probe = {
        healthy: false,
        reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.RECOVERY_PROBE_FAILED,
        failureCategory: classifyErrorFailureCategory(error),
        rawPayloadExposed: false,
      };
    }

    const recoveredControl = await this.completeRecoveryProbe({
      dbClient,
      probe,
      now: normalizeTimestamp(this.now()),
    });
    const recovered = probe?.healthy === true &&
      recoveredControl.circuitState === NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED;

    return buildControlEligibility({
      allowed: false,
      statusId: recovered
        ? 'deferred_after_reconciliation_recovery_probe'
        : 'deferred_by_reconciliation_circuit_breaker',
      reasonId: recovered
        ? NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.AUTOMATIC_RECOVERY
        : (probe?.reasonId || NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.RECOVERY_PROBE_REQUIRED),
      control: recoveredControl,
    });
  }

  async recordSystemFailure({ dbClient = this.db, failureCategory, now = this.now() } = {}) {
    const recordedAt = normalizeTimestamp(now);
    if (!failureCategory || !recordedAt) return { changed: false, opened: false, control: null };

    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (
          !control.automationEnabled ||
          control.circuitState !== NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.CLOSED
        ) {
          return { changed: false, opened: false, control };
        }

        const transition = buildSystemFailureTransition({
          control,
          failureCategory,
          now: recordedAt,
        });
        if (!transition.changed) return transition;

        const persisted = normalizeControl(await this.persistControl({
          client,
          control: transition.control,
        }));
        if (transition.opened) {
          await this.insertEvent({
            client,
            eventType: NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS.CIRCUIT_OPENED,
            reasonId: NATIVE_INTENT_RECONCILIATION_CONTROL_REASON_IDS.CIRCUIT_OPEN,
            failureCategory: transition.failureCategory,
            actorType: 'system',
            occurredAt: recordedAt,
          });
          this.logger.warn?.('Native intent reconciliation circuit opened', {
            failureCategory: transition.failureCategory,
            failureCount: persisted.failureCount,
          });
        }

        return { ...transition, control: persisted };
      },
    });
  }

  async recordExecutionResult({ dbClient = this.db, applyGate, now = this.now() } = {}) {
    const failureCategory = classifyApplyGateSystemFailure(applyGate);
    if (failureCategory) {
      return this.recordSystemFailure({ dbClient, failureCategory, now });
    }

    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        const transition = buildSuccessfulEvaluationTransition({ control, now });
        if (!transition.changed) return transition;
        return {
          ...transition,
          control: normalizeControl(await this.persistControl({
            client,
            control: transition.control,
          })),
        };
      },
    });
  }

  async recordExecutionError({ dbClient = this.db, error, now = this.now() } = {}) {
    const failureCategory = classifyErrorFailureCategory(error);
    if (!failureCategory) return { changed: false, opened: false, control: null };
    return this.recordSystemFailure({ dbClient, failureCategory, now });
  }

  async disableAutomation({ dbClient = this.db, action = {}, now = this.now() } = {}) {
    const actionValidation = validateOperatorAction(action);
    const occurredAt = normalizeTimestamp(now);
    if (!actionValidation.ok || !occurredAt) {
      return { changed: false, reasonId: 'control_action_invalid', rawPayloadExposed: false };
    }

    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (!control.automationEnabled) {
          return { changed: false, reasonId: 'automation_already_disabled', control, rawPayloadExposed: false };
        }
        const persisted = normalizeControl(await this.persistControl({
          client,
          control: {
            ...control,
            automationEnabled: false,
            manualDisabledAt: occurredAt,
            manualDisabledReasonId: actionValidation.reasonId,
          },
        }));
        await this.insertEvent({
          client,
          eventType: NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS.AUTOMATION_DISABLED,
          reasonId: actionValidation.reasonId,
          actorType: 'operator',
          actorId: actionValidation.actorId,
          occurredAt,
        });
        return { changed: true, reasonId: actionValidation.reasonId, control: persisted, rawPayloadExposed: false };
      },
    });
  }

  async resumeAutomation({ dbClient = this.db, action = {}, now = this.now() } = {}) {
    const actionValidation = validateOperatorAction(action);
    const occurredAt = normalizeTimestamp(now);
    if (!actionValidation.ok || !occurredAt) {
      return { changed: false, reasonId: 'control_action_invalid', rawPayloadExposed: false };
    }

    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (control.automationEnabled) {
          return { changed: false, reasonId: 'automation_already_enabled', control, rawPayloadExposed: false };
        }
        const persisted = normalizeControl(await this.persistControl({
          client,
          control: {
            ...control,
            automationEnabled: true,
            manualDisabledAt: null,
            manualDisabledReasonId: null,
          },
        }));
        await this.insertEvent({
          client,
          eventType: NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS.AUTOMATION_ENABLED,
          reasonId: actionValidation.reasonId,
          actorType: 'operator',
          actorId: actionValidation.actorId,
          occurredAt,
        });
        return { changed: true, reasonId: actionValidation.reasonId, control: persisted, rawPayloadExposed: false };
      },
    });
  }

  async resetCircuit({ dbClient = this.db, action = {}, now = this.now() } = {}) {
    const actionValidation = validateOperatorAction(action);
    const occurredAt = normalizeTimestamp(now);
    if (!actionValidation.ok || !occurredAt) {
      return { changed: false, reasonId: 'control_action_invalid', rawPayloadExposed: false };
    }

    return this.withLockedControl({
      dbClient,
      work: async ({ client, control }) => {
        if (
          control.circuitState !== NATIVE_INTENT_RECONCILIATION_CIRCUIT_STATE_IDS.OPEN ||
          control.recoveryRequirement !== NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.ADMIN_RESET
        ) {
          return { changed: false, reasonId: 'circuit_reset_not_required', control, rawPayloadExposed: false };
        }
        const persisted = normalizeControl(await this.persistControl({
          client,
          control: {
            ...control,
            recoveryRequirement:
              NATIVE_INTENT_RECONCILIATION_RECOVERY_REQUIREMENT_IDS.HEALTHY_EVALUATION,
            failureCount: 0,
            failureWindowStartedAt: null,
            recoveryProbeStartedAt: null,
          },
        }));
        await this.insertEvent({
          client,
          eventType: NATIVE_INTENT_RECONCILIATION_CONTROL_EVENT_TYPE_IDS.CIRCUIT_RESET,
          reasonId: actionValidation.reasonId,
          failureCategory: control.lastFailureCategory,
          actorType: 'operator',
          actorId: actionValidation.actorId,
          occurredAt,
        });
        return { changed: true, reasonId: actionValidation.reasonId, control: persisted, rawPayloadExposed: false };
      },
    });
  }
}

export const nativeIntentReconciliationControlService =
  new NativeIntentReconciliationControlService();
