/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpGet } from '../../utils/httpClient.mjs';
import { createLogger } from '../../utils/logger.mjs';
import { collectPlexGuidCandidates, parsePlexGuids } from './shared/providerIds.mjs';
import { sourceIdentityRecoveryEvidence } from '../sourceIdentityRecoveryEvidence.mjs';
import { appendQueryParam, buildPathUrl } from './shared/url.mjs';
import { readPlexSourcePage, sourcePageRequest } from './shared/sourcePage.mjs';
import { SourceEnumerationError } from '../sourceEnumerationError.mjs';
import { LIBRARY_CATALOG_REQUEST, readPlexLibraryCatalog } from './shared/libraryCatalog.mjs';
import { ServiceUnavailableError } from '../../utils/appError.mjs';

const logger = createLogger('PlexService');

function buildHeaders(apiKey) {
  return {
    'X-Plex-Token': apiKey,
    Accept: 'application/json',
  };
}

function buildRequestConfig(apiKey, config = {}) {
  return {
    ...config,
    headers: {
      ...buildHeaders(apiKey),
      ...(config.headers || {}),
    },
  };
}

class PlexService {
  buildPosterUrl(baseUrl, apiKey, path) {
    const resourceUrl = buildPathUrl(baseUrl, path);
    if (!resourceUrl) {
      return null;
    }

    return appendQueryParam(resourceUrl, 'X-Plex-Token', apiKey);
  }

  async testConnection(url, apiKey) {
    try {
      const response = await httpGet(
        `${url}/identity`,
        buildRequestConfig(apiKey, { timeout: 5000 }),
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLibraries(url, apiKey) {
    return (await this.getLibraryCatalog(url, apiKey)).filter(library => library.media_type !== null);
  }

  async getLibraryCatalog(url, apiKey) {
    try {
      const response = await httpGet(
        `${url}/library/sections`,
        buildRequestConfig(apiKey, LIBRARY_CATALOG_REQUEST),
      );

      return readPlexLibraryCatalog(response.data);
    } catch (error) {
      if (error?.code === 'library_catalog_invalid') throw error;
      throw new ServiceUnavailableError('Failed to fetch Plex libraries. Check the media server connection and access; existing libraries were preserved.', { code: 'library_catalog_unavailable' });
    }
  }

  async getLibraryItems(url, apiKey, libraryKey, options = {}) {
    return (await this.getLibraryPage(url, apiKey, libraryKey, options)).items;
  }

  async getLibraryPage(url, apiKey, libraryKey, options = {}) {
    const { offset, limit } = sourcePageRequest(options);

    try {
      const response = await httpGet(
        `${url}/library/sections/${libraryKey}/all`,
        buildRequestConfig(apiKey, {
          signal: options.signal,
          ...(options.preflight ? { timeout: 5000, maxResponseBytes: 1048576 } : {}),
          headers: { 'X-Plex-Container-Start': offset, 'X-Plex-Container-Size': limit },
          params: {
            'X-Plex-Container-Start': offset,
            'X-Plex-Container-Size': limit,
            includeGuids: 1,
          },
        }),
      );

      const page = readPlexSourcePage(response);

      return { ...page, items: page.items.map((item) => {
        if (typeof item.type !== 'string' || !item.type.trim()) throw new SourceEnumerationError('missing_media_type');
        const mediaType = item?.type === 'show' ? 'tv' : item?.type === 'movie' ? 'movie' : null;
        // Retain the source page position without exposing unsupported item metadata.
        if (!mediaType) return { media_type: null, total: page.total };
        const parsed = this.parseGuids(item);
        return {
          external_id: item.ratingKey,
          title: item.title,
          original_title: item.originalTitle,
          year: item.year,
          media_type: mediaType,
          genres: (item.Genre || []).map((genre) => genre.tag),
          tags: (item.Label || []).map((tag) => tag.tag),
          collections: (item.Collection || []).map((collection) => collection.tag),
          studio: item.studio,
          content_rating: item.contentRating,
          added_at: item.addedAt ? new Date(item.addedAt * 1000) : null,
          ...parsed,
          ...(parsed.provider_identity_invalid ? {
            source_identity_evidence: sourceIdentityRecoveryEvidence({ external_id: String(item.ratingKey),
              title: item.title, year: item.year, media_type: mediaType },
            String(libraryKey), collectPlexGuidCandidates(item.Guid || [])),
          } : {}),
          metadata: {
            rating: item.rating,
            summary: item.summary,
            thumb: item.thumb,
            posterPath: this.buildPosterUrl(
              url,
              apiKey,
              item.thumb || item.parentThumb || item.grandparentThumb,
            ),
          },
          total: page.total,
        };
      }) };
    } catch (error) {
      if (options.preflight || error instanceof SourceEnumerationError) throw error;
      throw new Error(`Failed to fetch Plex library items: ${error.message}`);
    }
  }

  /**
   * Fetch only one current source item and the provider IDs needed for a
   * read-only identity-evidence comparison. A caller never receives title,
   * summary, artwork, or any persisted item fields.
   */
  async getLibraryItemIdentityEvidence(url, apiKey, libraryKey, externalId) {
    const sourceId = typeof externalId === 'string' ? externalId.trim() : '';
    const sourceLibrary = String(libraryKey ?? '');
    if (!sourceId || !sourceLibrary) return null;
    try {
      const response = await httpGet(
        `${url}/library/metadata/${encodeURIComponent(sourceId)}`,
        buildRequestConfig(apiKey, { params: { includeGuids: 1 }, timeout: 10000 }),
      );
      const item = response.data?.MediaContainer?.Metadata?.[0];
      if (!item || String(item.ratingKey) !== sourceId || String(item.librarySectionID) !== sourceLibrary) return null;
      const mediaType = item.type === 'show' ? 'tv' : item.type === 'movie' ? 'movie' : null;
      const providerIds = collectPlexGuidCandidates(item.Guid || []);
      const recovery = sourceIdentityRecoveryEvidence({ external_id: sourceId, title: item.title,
        year: item.year, media_type: mediaType }, sourceLibrary, providerIds);
      return mediaType && providerIds ? Object.freeze({ mediaType, providerIds,
        ...(recovery ? { snapshotDigest: recovery.snapshotDigest } : {}) }) : null;
    } catch (error) {
      throw new Error(`Failed to fetch Plex library item identity evidence: ${error.message}`);
    }
  }

  async getCollections(url, apiKey, libraryKey, options = {}) {
    return (await this.getCollectionPage(url, apiKey, libraryKey, options)).items;
  }

  async getCollectionPage(url, apiKey, libraryKey, options = {}) {
    const { offset, limit } = sourcePageRequest(options);
    try {
      const response = await httpGet(
        `${url}/library/sections/${libraryKey}/collections`,
        buildRequestConfig(apiKey, {
          signal: options.signal,
          ...(options.preflight ? { timeout: 5000, maxResponseBytes: 1048576 } : {}),
          headers: { 'X-Plex-Container-Start': offset, 'X-Plex-Container-Size': limit },
          params: { 'X-Plex-Container-Start': offset, 'X-Plex-Container-Size': limit },
        }),
      );

      const page = readPlexSourcePage(response);
      return { ...page, items: page.items.map((item) => ({
        external_id: item.ratingKey,
        name: item.title,
        item_count: item.childCount || 0,
      })) };
    } catch (error) {
      if (options.preflight || error instanceof SourceEnumerationError) throw error;
      throw new Error(`Failed to fetch Plex collections: ${error.message}`);
    }
  }

  async searchByProviderIds(url, apiKey, tmdbId, _mediaType) {
    try {
      const response = await httpGet(
        `${url}/library/all`,
        buildRequestConfig(apiKey, {
          params: {
            guid: `tmdb://${tmdbId}`,
          },
        }),
      );

      const items = response.data?.MediaContainer?.Metadata || [];
      return items.length > 0 ? items[0] : null;
    } catch (_error) {
      return null;
    }
  }

  parseGuids(item) {
    return parsePlexGuids(item.Guid || []);
  }

  async triggerLibraryScan(url, apiKey, libraryKey) {
    try {
      await httpGet(
        `${url}/library/sections/${libraryKey}/refresh`,
        buildRequestConfig(apiKey, { timeout: 10000 }),
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async triggerPartialScan(url, apiKey, libraryKey, paths) {
    const results = {
      success: true,
      scanned: 0,
      failed: 0,
      errors: [],
    };

    for (const path of paths) {
      try {
        await httpGet(
          `${url}/library/sections/${libraryKey}/refresh`,
          buildRequestConfig(apiKey, {
            params: {
              path,
            },
            timeout: 10000,
          }),
        );

        results.scanned += 1;
      } catch (error) {
        results.failed += 1;
        results.errors.push(`Failed to scan ${path}: ${error.message}`);
      }
    }

    if (results.failed > 0) {
      results.success = false;
    }

    return results;
  }

  async triggerScanAfterMove(url, apiKey, libraryKey, paths = []) {
    if (paths.length > 0) {
      const partialResult = await this.triggerPartialScan(url, apiKey, libraryKey, paths);

      if (partialResult.success) {
        return {
          success: true,
          type: 'partial',
          details: partialResult,
        };
      }

      logger.warn(`Partial scan failed for library ${libraryKey}, falling back to full scan`);
    }

    const fullResult = await this.triggerLibraryScan(url, apiKey, libraryKey);

    return {
      success: fullResult.success,
      type: 'full',
      details: fullResult,
    };
  }
}

export const plexService = new PlexService();
