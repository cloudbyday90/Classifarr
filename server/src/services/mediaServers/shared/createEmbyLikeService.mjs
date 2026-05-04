/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import axios from 'axios';
import { appendQueryParam, normalizeBaseUrl } from './url.mjs';
import { parseProviderIds } from './providerIds.mjs';

function buildHeaders(apiKey) {
  return {
    'X-Emby-Token': apiKey,
  };
}

function buildCreateEmbyLikeServiceModule({ axiosClient, normalizeBaseUrl: _normalizeBaseUrl, appendQueryParam: _appendQueryParam, parseProviderIds: _parseProviderIds }) {
  class EmbyLikeService {
    constructor(displayName) {
      this.displayName = displayName;
    }

    buildPosterUrl(baseUrl, apiKey, itemId) {
      if (!itemId) {
        return null;
      }

      const itemUrl = `${_normalizeBaseUrl(baseUrl)}/Items/${itemId}/Images/Primary`;
      return _appendQueryParam(itemUrl, 'api_key', apiKey);
    }

    async testConnection(url, apiKey) {
      try {
        const response = await axiosClient.get(`${url}/System/Info`, {
          headers: buildHeaders(apiKey),
          timeout: 5000,
        });
        return { success: true, data: response.data };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    async getLibraries(url, apiKey) {
      try {
        const response = await axiosClient.get(`${url}/Library/VirtualFolders`, {
          headers: buildHeaders(apiKey),
        });

        return response.data
          .filter((library) => library.CollectionType === 'movies' || library.CollectionType === 'tvshows')
          .map((library) => ({
            external_id: library.ItemId,
            name: library.Name,
            media_type: library.CollectionType === 'tvshows' ? 'tv' : 'movie',
          }));
      } catch (error) {
        throw new Error(`Failed to fetch ${this.displayName} libraries: ${error.message}`);
      }
    }

    async getLibraryItems(url, apiKey, libraryId, options = {}) {
      const { offset = 0, limit = 100 } = options;

      try {
        const response = await axiosClient.get(`${url}/Items`, {
          headers: buildHeaders(apiKey),
          params: {
            ParentId: libraryId,
            Recursive: true,
            IncludeItemTypes: 'Movie,Series',
            StartIndex: offset,
            Limit: limit,
            Fields: 'ProviderIds,Genres,Tags,Studios,Overview',
          },
        });

        const items = response.data.Items || [];

        return items.map((item) => ({
          external_id: item.Id,
          title: item.Name,
          original_title: item.OriginalTitle,
          year: item.ProductionYear,
          media_type: item.Type === 'Series' ? 'tv' : 'movie',
          genres: item.Genres || [],
          tags: item.Tags || [],
          collections: [],
          studio: item.Studios?.[0]?.Name,
          content_rating: item.OfficialRating,
          added_at: item.DateCreated ? new Date(item.DateCreated) : null,
          ...this.parseGuids(item),
          metadata: {
            rating: item.CommunityRating,
            summary: item.Overview,
            posterPath: this.buildPosterUrl(url, apiKey, item.Id),
          },
          total: response.data.TotalRecordCount,
        }));
      } catch (error) {
        throw new Error(`Failed to fetch ${this.displayName} library items: ${error.message}`);
      }
    }

    async getCollections(url, apiKey, libraryId) {
      try {
        const response = await axiosClient.get(`${url}/Items`, {
          headers: buildHeaders(apiKey),
          params: {
            ParentId: libraryId,
            IncludeItemTypes: 'BoxSet',
            Recursive: true,
          },
        });

        const items = response.data.Items || [];
        return items.map((item) => ({
          external_id: item.Id,
          name: item.Name,
          item_count: item.ChildCount || 0,
        }));
      } catch (_error) {
        return [];
      }
    }

    async searchByProviderIds(url, apiKey, tmdbId, _mediaType) {
      try {
        const response = await axiosClient.get(`${url}/Items`, {
          headers: buildHeaders(apiKey),
          params: {
            Recursive: true,
            AnyProviderIdEquals: `Tmdb.${tmdbId}`,
          },
        });

        const items = response.data.Items || [];
        return items.length > 0 ? items[0] : null;
      } catch (_error) {
        return null;
      }
    }

    parseGuids(item) {
      return _parseProviderIds(item.ProviderIds || {});
    }
  }

  function createEmbyLikeService({ displayName }) {
    return new EmbyLikeService(displayName);
  }

  const createEmbyLikeServiceModule = { createEmbyLikeService };
  createEmbyLikeServiceModule.default = createEmbyLikeServiceModule;
  return createEmbyLikeServiceModule;
}

const createEmbyLikeServiceModule = buildCreateEmbyLikeServiceModule({
  axiosClient: axios,
  normalizeBaseUrl,
  appendQueryParam,
  parseProviderIds,
});

export const { createEmbyLikeService } = createEmbyLikeServiceModule;

export default createEmbyLikeServiceModule;
