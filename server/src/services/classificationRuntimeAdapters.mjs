/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function createClassificationRoutingService({
  ensureDecisionQuestion,
  isSettingsEmpty,
  normalizeQualityProfileId,
  normalizeSettings,
  resolveDefaultQualityProfile,
  resolveDefaultRootFolder,
  resolveRoutingConfig,
  routeToArr,
  suggestSeriesType,
}) {
  return {
    ensureDecisionQuestion,
    isSettingsEmpty,
    normalizeQualityProfileId,
    normalizeSettings,
    resolveDefaultQualityProfile,
    resolveDefaultRootFolder,
    resolveRoutingConfig,
    routeToArr,
    suggestSeriesType,
  };
}

function createLibraryLabelsService({
  evaluateCustomRule,
  evaluateSingleCondition,
  matchRules,
  metadataMatchesLabel,
}) {
  return {
    matchRules,
    metadataMatchesLabel,
    evaluateCustomRule,
    evaluateSingleCondition,
  };
}

function createClassificationMetadataService({
  detectEventTypesFromMetadata,
  enrichWithTMDB,
  enrichWithWebSearch,
  getTavilyConfig,
  mergeMetadataForRecheck,
  mightBeAnime,
  parseOverseerrPayload,
}) {
  return {
    detectEventTypesFromMetadata,
    enrichWithTMDB,
    enrichWithWebSearch,
    getTavilyConfig,
    mergeMetadataForRecheck,
    mightBeAnime,
    parseOverseerrPayload,
  };
}

function createClassificationUtilsService({
  buildParseDiagnostics,
  buildPendingRetryResult,
  isAiTransientAvailabilityError,
  resolveRagLoopTimeout,
  resolveRetryReason,
  sleep,
  withRetryableDbConflict,
  withTimeout,
}) {
  return {
    buildParseDiagnostics,
    buildPendingRetryResult,
    isAiTransientAvailabilityError,
    resolveRagLoopTimeout,
    resolveRetryReason,
    sleep,
    withRetryableDbConflict,
    withTimeout,
  };
}

function createClassificationAiService({
  aiClassify,
  attemptAiResponseRepair,
  buildAiRepairPrompt,
  normalizeAiResponseLine,
}) {
  return {
    aiClassify,
    attemptAiResponseRepair,
    buildAiRepairPrompt,
    normalizeAiResponseLine,
  };
}

function createClassificationCoreDependencies({
  infrastructure = {},
  workflowServices = {},
  domainServices = {},
  utilities = {},
  runtimeServices = {},
} = {}) {
  return {
    infrastructure,
    workflowServices,
    domainServices,
    utilities,
    runtimeServices,
  };
}

export {
  createClassificationAiService,
  createClassificationCoreDependencies,
  createClassificationMetadataService,
  createClassificationRoutingService,
  createClassificationUtilsService,
  createLibraryLabelsService,
};
