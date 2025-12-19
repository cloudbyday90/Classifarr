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

class PlexService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/identity`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
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
      const response = await axios.get(`${url}/library/sections`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      const sections = response.data.MediaContainer.Directory || [];
      return sections
        .filter(section => section.type === 'movie' || section.type === 'show')
        .map(section => ({
          external_id: section.key,
          name: section.title,
          media_type: section.type === 'show' ? 'tv' : 'movie',
        }));
    } catch (error) {
      throw new Error(`Failed to fetch Plex libraries: ${error.message}`);
    }
  }

  async getLibraryItems(url, apiKey, libraryKey, options = {}) {
    const { offset = 0, limit = 100 } = options;
    
    try {
      const response = await axios.get(`${url}/library/sections/${libraryKey}/all`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
        },
        params: {
          'X-Plex-Container-Start': offset,
          'X-Plex-Container-Size': limit,
        },
      });

      const container = response.data.MediaContainer;
      const items = container.Metadata || [];
      
      return items.map(item => ({
        external_id: item.ratingKey,
        title: item.title,
        original_title: item.originalTitle,
        year: item.year,
        media_type: item.type === 'show' ? 'tv' : 'movie',
        genres: (item.Genre || []).map(g => g.tag),
        tags: (item.Label || []).map(t => t.tag),
        collections: (item.Collection || []).map(c => c.tag),
        studio: item.studio,
        content_rating: item.contentRating,
        added_at: item.addedAt ? new Date(item.addedAt * 1000) : null,
        ...this.parseGuids(item),
        metadata: {
          rating: item.rating,
          summary: item.summary,
          thumb: item.thumb,
        },
        total: container.totalSize,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Plex library items: ${error.message}`);
    }
  }

  async getCollections(url, apiKey, libraryKey) {
    try {
      const response = await axios.get(`${url}/library/sections/${libraryKey}/collections`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
        },
      });

      const items = response.data.MediaContainer.Metadata || [];
      return items.map(item => ({
        external_id: item.ratingKey,
        name: item.title,
        item_count: item.childCount || 0,
      }));
    } catch (error) {
      // Collections may not exist, return empty array
      return [];
    }
  }

  async searchByProviderIds(url, apiKey, tmdbId, mediaType) {
    try {
      const guid = `tmdb://${tmdbId}`;

      const response = await axios.get(`${url}/library/all`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
        },
        params: {
          guid: guid,
        },
      });

      const items = response.data.MediaContainer.Metadata || [];
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      return null;
    }
  }

  parseGuids(item) {
    const guids = item.Guid || [];
    const result = {
      tmdb_id: null,
      imdb_id: null,
      tvdb_id: null,
    };

    guids.forEach(guid => {
      const id = guid.id;
      if (id.startsWith('tmdb://')) {
        result.tmdb_id = parseInt(id.replace('tmdb://', ''));
      } else if (id.startsWith('imdb://')) {
        result.imdb_id = id.replace('imdb://', '');
      } else if (id.startsWith('tvdb://')) {
        result.tvdb_id = parseInt(id.replace('tvdb://', ''));
      }
    });

    return result;
  }
}

module.exports = new PlexService();
