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
  shouldSendHealthAlert,
  getAlertPreviousStatus,
};
