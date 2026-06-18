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

export class WebSearchProviderRoutingError extends Error {
  constructor(message, candidates = []) {
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
  }
}

export class WebSearchProviderRouter {
  constructor({
    storage = defaultStorage,
    registry = defaultRegistry,
    executor = defaultExecutor,
    nowFn = () => new Date(),
  } = {}) {
    this.storage = storage;
    this.registry = registry;
    this.executor = executor;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderRouter({
      storage: dependencies.storage || this.storage,
      registry: dependencies.registry || this.registry,
      executor: dependencies.executor || this.executor,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async getRouteCandidates() {
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

    return sortWebSearchProviderRouteCandidates(configs.map((config) => {
      const adapter = this.registry.getAdapter(config.providerKey);
      return evaluateWebSearchProviderRouteCandidate({
        config,
        adapter,
        usageSummary: usageSummaries.get(config.providerKey),
        now,
      });
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
    const route = await this.selectRoute();
    const result = await this.executor.search({
      provider: route.selected.adapter,
      request,
      config: route.selected.config,
      cacheTtlMs,
      bypassCache,
      cacheMetadata: {
        ...cacheMetadata,
        routedProvider: route.selected.providerKey,
      },
    });

    return {
      ...result,
      route,
    };
  }
}

export const webSearchProviderRouter = new WebSearchProviderRouter();
