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
  validateWebSearchProvider,
  validateWebSearchResponse,
} from './webSearchProviderContract.mjs';
import {
  buildWebSearchProviderCacheIdentity,
  normalizeWebSearchProviderCacheTtlMs,
} from './webSearchProviderCachePolicy.mjs';
import { webSearchProviderStorage as defaultUsageStorage } from './webSearchProviderStorage.mjs';
import { webSearchProviderUsageCache as defaultCacheStore } from './webSearchProviderUsageCache.mjs';

function getTraceValue(request, key) {
  return request?.traceContext?.[key] ?? null;
}

function getResultCount(response) {
  return Array.isArray(response?.results) ? response.results.length : 0;
}

function getDurationMs(startedAt, nowFn) {
  return Math.max(0, nowFn() - startedAt);
}

function buildCacheMetadata(metadata, cache) {
  return {
    ...metadata,
    cacheKey: cache.cacheKey,
    cacheHit: Boolean(cache.hit),
    cacheSource: 'web_search_provider_cache',
  };
}

export class WebSearchProviderCachedSearchExecutor {
  constructor({
    cacheStore = defaultCacheStore,
    usageStorage = defaultUsageStorage,
    nowFn = () => Date.now(),
  } = {}) {
    this.cacheStore = cacheStore;
    this.usageStorage = usageStorage;
    this.nowFn = nowFn;
  }

  withDependencies(dependencies = {}) {
    return new WebSearchProviderCachedSearchExecutor({
      cacheStore: dependencies.cacheStore || this.cacheStore,
      usageStorage: dependencies.usageStorage || this.usageStorage,
      nowFn: dependencies.nowFn || this.nowFn,
    });
  }

  async recordUsageSafely(input) {
    if (!this.usageStorage?.recordUsage) return null;
    try {
      return await this.usageStorage.recordUsage(input);
    } catch {
      return null;
    }
  }

  async updateProviderSafely(providerKey, usage) {
    if (!this.usageStorage?.updateProviderAfterUsage) return null;
    try {
      return await this.usageStorage.updateProviderAfterUsage(providerKey, usage);
    } catch {
      return null;
    }
  }

  async search({
    provider,
    request,
    config = {},
    cacheTtlMs,
    bypassCache = false,
    cacheMetadata = {},
  } = {}) {
    const validatedProvider = validateWebSearchProvider(provider);
    const identity = buildWebSearchProviderCacheIdentity({
      providerKey: validatedProvider.providerKey,
      request,
      config,
    });
    const ttlMs = normalizeWebSearchProviderCacheTtlMs(cacheTtlMs);
    const trace = identity.request.traceContext || {};

    if (!bypassCache && ttlMs > 0) {
      const cached = await this.cacheStore.getFreshResponse(identity.cacheKey);
      if (cached) {
        await this.cacheStore.recordHit(identity.cacheKey);
        await this.recordUsageSafely({
          providerKey: identity.providerKey,
          purpose: identity.purpose,
          operation: 'cache_hit',
          status: 'success',
          costUnits: 0,
          resultCount: getResultCount(cached.response),
          correlationId: getTraceValue(identity.request, 'correlationId'),
          classificationId: getTraceValue(identity.request, 'classificationId'),
          metadata: buildCacheMetadata(cacheMetadata, {
            hit: true,
            cacheKey: identity.cacheKey,
          }),
        });

        return {
          response: cached.response,
          cache: {
            hit: true,
            cacheKey: identity.cacheKey,
            expiresAt: cached.expiresAt,
            ttlMs,
          },
        };
      }
    }

    const startedAt = this.nowFn();
    try {
      const response = validateWebSearchResponse(await validatedProvider.search(identity.request, config));
      const stored = ttlMs > 0
        ? await this.cacheStore.storeResponse({
          cacheKey: identity.cacheKey,
          providerKey: identity.providerKey,
          purpose: identity.purpose,
          queryHash: identity.queryHash,
          requestFingerprint: identity.requestFingerprint,
          queryPreview: identity.queryPreview,
          response,
          ttlMs,
          metadata: buildCacheMetadata(cacheMetadata, {
            hit: false,
            cacheKey: identity.cacheKey,
          }),
        })
        : null;

      await this.recordUsageSafely({
        providerKey: identity.providerKey,
        purpose: identity.purpose,
        operation: 'search',
        status: 'success',
        costUnits: response.usage?.costUnits ?? 1,
        resultCount: getResultCount(response),
        durationMs: getDurationMs(startedAt, this.nowFn),
        correlationId: trace.correlationId || null,
        classificationId: trace.classificationId ?? null,
        metadata: buildCacheMetadata(cacheMetadata, {
          hit: false,
          cacheKey: identity.cacheKey,
        }),
      });
      await this.updateProviderSafely(identity.providerKey, {
        status: 'success',
        purpose: identity.purpose,
        operation: 'search',
        correlationId: trace.correlationId || null,
        classificationId: trace.classificationId ?? null,
        metadata: buildCacheMetadata(cacheMetadata, {
          hit: false,
          cacheKey: identity.cacheKey,
        }),
      });

      return {
        response,
        cache: {
          hit: false,
          cacheKey: identity.cacheKey,
          expiresAt: stored?.expiresAt || null,
          ttlMs,
        },
      };
    } catch (error) {
      await this.recordUsageSafely({
        providerKey: identity.providerKey,
        purpose: identity.purpose,
        operation: 'search',
        durationMs: getDurationMs(startedAt, this.nowFn),
        correlationId: trace.correlationId || null,
        classificationId: trace.classificationId ?? null,
        error,
        metadata: buildCacheMetadata(cacheMetadata, {
          hit: false,
          cacheKey: identity.cacheKey,
        }),
      });
      await this.updateProviderSafely(identity.providerKey, {
        error,
        purpose: identity.purpose,
        operation: 'search',
        correlationId: trace.correlationId || null,
        classificationId: trace.classificationId ?? null,
        metadata: buildCacheMetadata(cacheMetadata, {
          hit: false,
          cacheKey: identity.cacheKey,
        }),
      });
      throw error;
    }
  }
}

export const webSearchProviderCachedSearchExecutor = new WebSearchProviderCachedSearchExecutor();
