/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function createTimedHealthState(overrides = {}) {
  return {
    status: 'unknown',
    lastCheck: null,
    lastSuccessfulCheck: null,
    responseTime: null,
    previousStatus: null,
    previousResponseTime: null,
    ...overrides,
  };
}

function createRagHealthState(overrides = {}) {
  return {
    status: 'unknown',
    lastCheck: null,
    lastSuccessfulCheck: null,
    pgvector: false,
    provider: null,
    previousStatus: null,
    ...overrides,
  };
}

function createImageEmbeddingsHealthState(overrides = {}) {
  return createTimedHealthState({
    provider: 'unknown',
    mode: 'disabled',
    readiness: 'unknown',
    ready: null,
    ...overrides,
  });
}

function createDefaultHealthCache() {
  return {
    database: createTimedHealthState(),
    discordBot: createTimedHealthState(),
    ollama: createTimedHealthState({ provider: null }),
    rag: createRagHealthState(),
    radarr: createTimedHealthState({ instances: [] }),
    sonarr: createTimedHealthState({ instances: [] }),
    mediaServer: createTimedHealthState({ type: null, name: null }),
    tmdb: createTimedHealthState(),
    omdb: createTimedHealthState(),
    tavily: createTimedHealthState(),
    imageEmbeddings: createImageEmbeddingsHealthState(),
  };
}

function buildHealthState(previous = {}, overrides = {}) {
  const state = {
    lastCheck: new Date().toISOString(),
    lastSuccessfulCheck: previous.lastSuccessfulCheck ?? null,
    previousStatus: previous.status ?? null,
    ...overrides,
  };

  if (
    Object.prototype.hasOwnProperty.call(previous, 'responseTime')
    || Object.prototype.hasOwnProperty.call(overrides, 'previousResponseTime')
  ) {
    state.previousResponseTime = previous.responseTime ?? null;
  }

  return state;
}

function buildStatusHealthState(previous = {}, status, overrides = {}) {
  return buildHealthState(previous, {
    status,
    ...overrides,
  });
}

function buildNotConfiguredHealthState(previous = {}, overrides = {}) {
  return buildStatusHealthState(previous, 'not configured', overrides);
}

function buildTimedResultHealthState(previous = {}, result = {}, overrides = {}) {
  const isSuccess = result.success === true;

  return buildStatusHealthState(previous, isSuccess ? 'connected' : 'disconnected', {
    lastSuccessfulCheck: isSuccess ? new Date().toISOString() : previous.lastSuccessfulCheck ?? null,
    responseTime: result.time ?? null,
    error: result.error,
    ...overrides,
  });
}

function buildTimedInstanceHealthState(previous = {}, result = {}, overrides = {}) {
  return buildTimedResultHealthState(previous, result, overrides);
}

function buildAggregateInstancesHealthState(previous = {}, instances = [], overrides = {}) {
  const allConnected = instances.length > 0 && instances.every((instance) => instance.status === 'connected');
  const anyConnected = instances.some((instance) => instance.status === 'connected');
  const overallStatus = allConnected ? 'connected' : (anyConnected ? 'partial' : 'disconnected');
  const responseTimes = instances
    .map((instance) => instance.responseTime)
    .filter((responseTime) => Number.isFinite(responseTime));
  const averageResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((sum, responseTime) => sum + responseTime, 0) / responseTimes.length)
    : null;

  return buildStatusHealthState(previous, overallStatus, {
    lastSuccessfulCheck: allConnected ? new Date().toISOString() : previous.lastSuccessfulCheck ?? null,
    instances,
    responseTime: averageResponseTime,
    ...overrides,
  });
}

function buildConfiguredHealthState(previous = {}, overrides = {}) {
  return buildStatusHealthState(previous, 'configured', {
    lastSuccessfulCheck: new Date().toISOString(),
    responseTime: null,
    ...overrides,
  });
}

function buildDisabledHealthState(previous = {}, overrides = {}) {
  return buildStatusHealthState(previous, 'disabled', overrides);
}

function buildRagHealthState(previous = {}, status, overrides = {}) {
  return buildStatusHealthState(previous, status, {
    pgvector: false,
    provider: null,
    ...overrides,
  });
}

function buildImageEmbeddingsHealthState(previous = {}, status, overrides = {}) {
  return buildStatusHealthState(previous, status, {
    provider: 'unknown',
    mode: 'disabled',
    readiness: 'unknown',
    ready: null,
    ...overrides,
  });
}

function buildErrorHealthState(previous = {}, error, overrides = {}) {
  return buildStatusHealthState(previous, 'error', {
    error: error?.message ?? error ?? null,
    ...overrides,
  });
}

function shouldSendHealthAlert(previousStatus, newStatus, unhealthyStatuses) {
  if (previousStatus === newStatus) {
    return false;
  }

  if ((!previousStatus || previousStatus === 'unknown') && !unhealthyStatuses.has(newStatus)) {
    return false;
  }

  if (!unhealthyStatuses.has(newStatus) && !unhealthyStatuses.has(previousStatus)) {
    return false;
  }

  return true;
}

function getAlertPreviousStatus(previousStatus) {
  return previousStatus && previousStatus !== 'unknown' ? previousStatus : null;
}

export {
  createTimedHealthState,
  createRagHealthState,
  createImageEmbeddingsHealthState,
  createDefaultHealthCache,
  buildHealthState,
  buildStatusHealthState,
  buildNotConfiguredHealthState,
  buildTimedResultHealthState,
  buildTimedInstanceHealthState,
  buildAggregateInstancesHealthState,
  buildConfiguredHealthState,
  buildDisabledHealthState,
  buildRagHealthState,
  buildImageEmbeddingsHealthState,
  buildErrorHealthState,
  shouldSendHealthAlert,
  getAlertPreviousStatus,
};
