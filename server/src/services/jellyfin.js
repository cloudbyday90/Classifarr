/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const axios = require('axios');

class JellyfinService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/System/Info`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        timeout: 5000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLibraries(url, apiKey) {
    try {
      const response = await axios.get(`${url}/Library/VirtualFolders`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
      });

      return response.data
        .filter(lib => lib.CollectionType === 'movies' || lib.CollectionType === 'tvshows')
        .map(lib => ({
          external_id: lib.ItemId,
          name: lib.Name,
          media_type: lib.CollectionType === 'tvshows' ? 'tv' : 'movie',
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Jellyfin libraries: ${error.message}`);
    }
  }

  async getLibraryItems(url, apiKey, libraryId, options = {}) {
    const { offset = 0, limit = 100 } = options;
    
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
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
      
      return items.map(item => ({
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
        },
        total: response.data.TotalRecordCount,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Jellyfin library items: ${error.message}`);
    }
  }

  async getCollections(url, apiKey, libraryId) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        params: {
          ParentId: libraryId,
          IncludeItemTypes: 'BoxSet',
          Recursive: true,
        },
      });

      const items = response.data.Items || [];
      return items.map(item => ({
        external_id: item.Id,
        name: item.Name,
        item_count: item.ChildCount || 0,
      }));
    } catch (error) {
      return [];
    }
  }

  async searchByProviderIds(url, apiKey, tmdbId, mediaType) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        params: {
          Recursive: true,
          AnyProviderIdEquals: `Tmdb.${tmdbId}`,
        },
      });

      const items = response.data.Items || [];
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      return null;
    }
  }

  parseGuids(item) {
    const providerIds = item.ProviderIds || {};
    return {
      tmdb_id: providerIds.Tmdb ? parseInt(providerIds.Tmdb) : null,
      imdb_id: providerIds.Imdb || null,
      tvdb_id: providerIds.Tvdb ? parseInt(providerIds.Tvdb) : null,
    };
  }
}

module.exports = new JellyfinService();
