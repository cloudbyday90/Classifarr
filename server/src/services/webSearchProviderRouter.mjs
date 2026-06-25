/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { webSearchProviderCachedSearchExecutor as defaultExecutor } from './webSearchProviderCachedSearch.mjs';
import { webSearchProviderRegistry as defaultRegistry } from './webSearchProviderRegistry.mjs';
import { webSearchProviderStorage as defaultStorage } from './webSearchProviderStorage.mjs';
import {
  WEB_SEARCH_PROVIDER_ROUTE_STATUS,
  evaluateWebSearchProviderRouteCandidate,
  sortWebSearchProviderRouteCandidates,
} from './webSearchProviderQuotaPolicy.mjs';
import {
  WEB_SEARCH_PROVIDER_ERROR_CODES,
  WebSearchProviderError,
} from './webSearchProviderErrorTaxonomy.mjs';
import {
  WEB_SEARCH_ROUTE_DECISION_OUTCOMES,
  webSearchProviderRouteHistory as defaultRouteHistory,
} from './webSearchProviderRouteHistory.mjs';
import {
  applyWebSearchProviderQualityCalibration,
  sortWebSearchProviderCandidatesByQuality,
  webSearchProviderQualityCalibrationService as defaultQualityCalibrationService,
} from './webSearchProviderQualityCalibration.mjs';

const FALLBACK_ELIGIBLE_ERROR_CODES = new Set([
  WEB_SEARCH_PROVIDER_ERROR_CODES.AUTH_FAILED,
  WEB_SEARCH_PROVIDER_ERROR_CODES.FORBIDDEN,
  WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
  WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED,
  WEB_SEARCH_PROVIDER_ERROR_CODES.NOT_FOUND,
  WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_RESPONSE_INVALID,
  WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX,
  WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT,
  WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR,
  WEB_SEARCH_PROVIDER_ERROR_CODES.SSL_ERROR,
]);

function sanitizeRouteAttempt(attempt) {
  return {
    providerKey: attempt.providerKey,
    outcome: attempt.outcome,
    errorCode: attempt.errorCode || null,
    httpStatus: attempt.httpStatus || null,
    retryAfterSeconds: attempt.retryAfterSeconds || null,
  };
}

export function isWebSearchProviderFallbackEligible(error) {
  return error instanceof WebSearchProviderError
    && FALLBACK_ELIGIBLE_ERROR_CODES.has(error.code);
}

export class WebSearchProviderRoutingError extends Error {
  constructor(message, candidates = [], {
    attempts = [],
    lastError = null,
  } = {}) {
    super(message);
    this.name = 'WebSearchProviderRoutingError';
    this.code = 'WEB_SEARCH_PROVIDER_ROUTE_UNAVAILABLE';
    this.candidates = candidates.map((candidate) => ({
      providerKey: candidate.providerKey,
      status: candidate.status,
      skipReason: candidate.skipReason,
      priority: candidate.priority,
      quota: candidate.quota,
    }));
    this.attempts = attempts.map(sanitizeRouteAttempt);
    this.lastError = lastError
      ? sanitizeRouteAttempt({
        providerKey: lastError.provider,
        outcome: 'failed',
        errorCode: lastError.code,
        httpStatus: lastError.httpStatus,
        retryAfterSeconds: lastError.retryAfterSeconds,
      })
      : null;
  }
}

export class WebSearchProviderRouter {
  constructor({
    storage = defaultStorage,
    registry = defaultRegistry,
    executor = defaultExecutor,
    routeHistory = defaultRouteHistory,
    qualityCalibrationService = defaultQualityCalibrationService,
    nowFn = () => new Date(),
  } = {}) {
    this.storage = storage;
    this.registry = registry;
    this.executor = executor;
    this.routeHistory = routeHistory;
    this.qualityCalibrationService = qualityCalibrationService;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderRouter({
      storage: dependencies.storage || this.storage,
      registry: dependencies.registry || this.registry,
      executor: dependencies.executor || this.executor,
      routeHistory: dependencies.routeHistory || this.routeHistory,
      qualityCalibrationService: dependencies.qualityCalibrationService || this.qualityCalibrationService,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async recordRouteDecision(input = {}) {
    if (!this.routeHistory?.recordDecisionSafely) return null;
    return this.routeHistory.recordDecisionSafely(input);
  }

  async getRouteCandidates({
    purpose = 'classification',
    calibrationPolicyOverride = null,
  } = {}) {
    const now = this.nowFn();
    const configs = await this.storage.listProviderConfigs({
      includeDisabled: true,
      maskSecrets: false,
      includeLegacyBridge: true,
    });
    const usageSummaries = await this.storage.getProviderUsageSummaries(
      configs.map((config) => config.providerKey),
      { now }
    );
    const qualityCalibrations = this.qualityCalibrationService?.getProviderQualityCalibrations
      ? await this.qualityCalibrationService.getProviderQualityCalibrations(
        configs.map((config) => config.providerKey),
        {
          purpose,
          now,
          ...(calibrationPolicyOverride || {}),
        }
      )
      : new Map();

    const baseCandidates = sortWebSearchProviderRouteCandidates(configs.map((config) => {
      const adapter = this.registry.getAdapter(config.providerKey);
      return evaluateWebSearchProviderRouteCandidate({
        config,
        adapter,
        usageSummary: usageSummaries.get(config.providerKey),
        now,
      });
    }));

    return sortWebSearchProviderCandidatesByQuality(baseCandidates.map((candidate) => {
      const calibration = qualityCalibrations.get(candidate.providerKey)?.calibration;
      return applyWebSearchProviderQualityCalibration(candidate, calibration);
    }));
  }

  async selectRoute() {
    const candidates = await this.getRouteCandidates();
    const selected = candidates.find((candidate) => (
      candidate.status === WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE
    ));

    if (!selected) {
      throw new WebSearchProviderRoutingError(
        'No web search provider is currently available for routing',
        candidates
      );
    }

    return {
      selected,
      candidates,
    };
  }

  async search(request, {
    cacheTtlMs,
    bypassCache = false,
    cacheMetadata = {},
  } = {}) {
    const routeStartedAt = this.nowFn();
    const candidates = await this.getRouteCandidates({ purpose: request?.purpose || 'classification' });
    const availableCandidates = candidates.filter((candidate) => (
      candidate.status === WEB_SEARCH_PROVIDER_ROUTE_STATUS.AVAILABLE
    ));

    if (availableCandidates.length === 0) {
      await this.recordRouteDecision({
        request,
        candidates,
        attempts: [],
        outcome: WEB_SEARCH_ROUTE_DECISION_OUTCOMES.NO_PROVIDER,
        errorCode: 'no_available_provider',
        startedAt: routeStartedAt,
        completedAt: this.nowFn(),
      });
      throw new WebSearchProviderRoutingError(
        'No web search provider is currently available for routing',
        candidates
      );
    }

    const attempts = [];
    let lastError = null;

    for (const candidate of availableCandidates) {
      try {
        const result = await this.executor.search({
          provider: candidate.adapter,
          request,
          config: candidate.config,
          cacheTtlMs,
          bypassCache,
          cacheMetadata: {
            ...cacheMetadata,
            routedProvider: candidate.providerKey,
          },
        });
        attempts.push({
          providerKey: candidate.providerKey,
          outcome: 'success',
        });
        const decision = await this.recordRouteDecision({
          request,
          candidates,
          attempts,
          outcome: WEB_SEARCH_ROUTE_DECISION_OUTCOMES.SUCCESS,
          selectedProviderKey: candidate.providerKey,
          finalProviderKey: candidate.providerKey,
          startedAt: routeStartedAt,
          completedAt: this.nowFn(),
          metadata: {
            cacheHit: Boolean(result.cache?.hit),
          },
        });

        return {
          ...result,
          route: {
            selected: candidate,
            candidates,
            attempts: attempts.map(sanitizeRouteAttempt),
            decision,
          },
        };
      } catch (error) {
        lastError = error;
        attempts.push({
          providerKey: candidate.providerKey,
          outcome: 'failed',
          errorCode: error.code || null,
          httpStatus: error.httpStatus || null,
          retryAfterSeconds: error.retryAfterSeconds || null,
        });

        if (!isWebSearchProviderFallbackEligible(error)) {
          await this.recordRouteDecision({
            request,
            candidates,
            attempts,
            outcome: WEB_SEARCH_ROUTE_DECISION_OUTCOMES.ERROR,
            selectedProviderKey: candidate.providerKey,
            errorCode: error.code || null,
            errorHttpStatus: error.httpStatus || null,
            startedAt: routeStartedAt,
            completedAt: this.nowFn(),
          });
          throw error;
        }
      }
    }

    await this.recordRouteDecision({
      request,
      candidates,
      attempts,
      outcome: WEB_SEARCH_ROUTE_DECISION_OUTCOMES.FAILED,
      selectedProviderKey: attempts[0]?.providerKey || null,
      errorCode: lastError?.code || null,
      errorHttpStatus: lastError?.httpStatus || null,
      startedAt: routeStartedAt,
      completedAt: this.nowFn(),
    });

    throw new WebSearchProviderRoutingError(
      'All eligible web search providers failed',
      candidates,
      { attempts, lastError }
    );
  }
}

export const webSearchProviderRouter = new WebSearchProviderRouter();
