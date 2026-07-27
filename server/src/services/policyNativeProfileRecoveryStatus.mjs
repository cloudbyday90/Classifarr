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
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

const POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS = Object.freeze({
  NOT_REQUIRED: 'not_required',
  SCHEDULED: 'scheduled',
  QUEUED: 'queued',
  PROCESSING: 'processing',
});

const PROFILE_RECOVERY_PRESENTATION = Object.freeze({
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.NOT_REQUIRED]: Object.freeze({
    label: 'Profile current',
    message: 'No automatic profile recovery is needed.',
  }),
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.SCHEDULED]: Object.freeze({
    label: 'Recovery scheduled',
    message: 'Classifarr will refresh this library profile automatically in the background. No action is needed.',
  }),
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.QUEUED]: Object.freeze({
    label: 'Recovery queued',
    message: 'Classifarr has queued an automatic library-profile refresh. No action is needed.',
  }),
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.PROCESSING]: Object.freeze({
    label: 'Refreshing profile',
    message: 'Classifarr is refreshing this library profile automatically. No action is needed.',
  }),
});

const AUTOMATIC_RECOVERY_ACTIONS = Object.freeze({
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.SCHEDULED]: Object.freeze({
    actionId: 'await_automatic_profile_recovery',
    label: 'Profile recovery is automatic',
  }),
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.QUEUED]: Object.freeze({
    actionId: 'await_automatic_profile_recovery',
    label: 'Profile refresh queued automatically',
  }),
  [POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.PROCESSING]: Object.freeze({
    actionId: 'await_automatic_profile_recovery',
    label: 'Profile refresh is in progress',
  }),
});

function isStaleProfileReadiness(readiness = {}) {
  return readiness?.stateId === 'stale_profile';
}

function isFutureRefresh(activeRefresh = null, now = new Date()) {
  const availableAt = Date.parse(activeRefresh?.availableAt);
  const evaluatedAt = now instanceof Date ? now.getTime() : Date.parse(now);

  return Number.isFinite(availableAt) && Number.isFinite(evaluatedAt) && availableAt > evaluatedAt;
}

function resolveRecoveryState(activeRefresh = null, now = new Date()) {
  const processingState = activeRefresh?.processingState;

  if (processingState === POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PROCESSING) {
    return POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.PROCESSING;
  }

  if (processingState === POLICY_PROFILE_REFRESH_OUTBOX_WORKER_STATE_IDS.PENDING) {
    return isFutureRefresh(activeRefresh, now)
      ? POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.SCHEDULED
      : POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.QUEUED;
  }

  return POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.SCHEDULED;
}

function buildNativeProfileRecoveryStatus({ readiness = {}, activeRefresh = null, now = new Date() } = {}) {
  const stateId = isStaleProfileReadiness(readiness)
    ? resolveRecoveryState(activeRefresh, now)
    : POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS.NOT_REQUIRED;
  const presentation = PROFILE_RECOVERY_PRESENTATION[stateId];

  return {
    stateId,
    label: presentation.label,
    message: presentation.message,
  };
}

function applyAutomaticProfileRecoveryToReadiness({ readiness = {}, profileRecovery = {} } = {}) {
  if (!isStaleProfileReadiness(readiness)) {
    return readiness;
  }

  const nextAction = AUTOMATIC_RECOVERY_ACTIONS[profileRecovery?.stateId];
  if (!nextAction) {
    return readiness;
  }

  return {
    ...readiness,
    nextAction,
  };
}

export {
  POLICY_NATIVE_PROFILE_RECOVERY_STATE_IDS,
  applyAutomaticProfileRecoveryToReadiness,
  buildNativeProfileRecoveryStatus,
  isStaleProfileReadiness,
  isFutureRefresh,
  resolveRecoveryState,
};
