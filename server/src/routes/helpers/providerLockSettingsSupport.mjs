/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export function buildHeartbeatConfigResponse(config) {
  return {
    heartbeat_timeout: config.heartbeatTimeout,
    heartbeat_interval: config.heartbeatInterval,
    max_wait_time: config.maxWaitTime,
  };
}

export function parseProviderLockInteger(value) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProviderLockUpdatePayload(body = {}, currentConfig) {
  const heartbeatTimeout = parseProviderLockInteger(body.heartbeat_timeout);
  const heartbeatInterval = parseProviderLockInteger(body.heartbeat_interval);
  const maxWaitTime = parseProviderLockInteger(body.max_wait_time);

  if (heartbeatTimeout === null) {
    return { error: 'heartbeat_timeout must be an integer' };
  }
  if (heartbeatInterval === null) {
    return { error: 'heartbeat_interval must be an integer' };
  }
  if (maxWaitTime === null) {
    return { error: 'max_wait_time must be an integer' };
  }

  if (heartbeatTimeout !== undefined && (heartbeatTimeout < 5000 || heartbeatTimeout > 120000)) {
    return { error: 'heartbeat_timeout must be between 5000 and 120000 ms' };
  }

  if (heartbeatInterval !== undefined && (heartbeatInterval < 1000 || heartbeatInterval > 30000)) {
    return { error: 'heartbeat_interval must be between 1000 and 30000 ms' };
  }

  if (maxWaitTime !== undefined && (maxWaitTime < 10000 || maxWaitTime > 300000)) {
    return { error: 'max_wait_time must be between 10000 and 300000 ms' };
  }

  const finalInterval = heartbeatInterval !== undefined ? heartbeatInterval : currentConfig.heartbeatInterval;
  const finalTimeout = heartbeatTimeout !== undefined ? heartbeatTimeout : currentConfig.heartbeatTimeout;

  if (finalInterval >= finalTimeout) {
    return { error: 'heartbeat_interval must be less than heartbeat_timeout' };
  }

  return {
    payload: {
      heartbeatTimeout,
      heartbeatInterval,
      maxWaitTime,
    },
  };
}

export function sendProviderLockErrorResponse(res, error) {
  const response = buildSettingsErrorResponse(error);
  return res.status(response.status).json(response.body);
}
