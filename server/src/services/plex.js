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

  /**
   * Get all items in a library with pagination
   */
  async getLibraryItems(url, token, libraryKey, options = {}) {
    try {
      const { offset = 0, limit = 100 } = options;
      const response = await axios.get(`${url}/library/sections/${libraryKey}/all`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' },
        params: { 'X-Plex-Container-Start': offset, 'X-Plex-Container-Size': limit }
      });
      
      const items = response.data.MediaContainer.Metadata || [];
      return {
        items: items.map(item => this.normalizeItem(item)),
        totalCount: response.data.MediaContainer.totalSize || items.length,
        offset,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to fetch Plex library items: ${error.message}`);
    }
  }

  /**
   * Get all collections in a library
   */
  async getCollections(url, token, libraryKey) {
    try {
      const response = await axios.get(`${url}/library/sections/${libraryKey}/collections`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' }
      });
      
      const collections = response.data.MediaContainer.Metadata || [];
      return collections.map(col => ({
        id: col.ratingKey,
        name: col.title,
        itemCount: col.childCount,
        thumb: col.thumb ? `${url}${col.thumb}?X-Plex-Token=${token}` : null
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Plex collections: ${error.message}`);
    }
  }

  /**
   * Get items in a collection
   */
  async getCollectionItems(url, token, collectionId) {
    try {
      const response = await axios.get(`${url}/library/collections/${collectionId}/children`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' }
      });
      
      const items = response.data.MediaContainer.Metadata || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch Plex collection items: ${error.message}`);
    }
  }

  /**
   * Search for item by GUID (TMDB/IMDB/TVDB)
   */
  async searchByGuid(url, token, guid) {
    try {
      const response = await axios.get(`${url}/library/all`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' },
        params: { guid }
      });
      return response.data.MediaContainer.Metadata || [];
    } catch (error) {
      throw new Error(`Failed to search Plex by GUID: ${error.message}`);
    }
  }

  /**
   * Get recently added items
   */
  async getRecentlyAdded(url, token, libraryKey, limit = 50) {
    try {
      const response = await axios.get(`${url}/library/sections/${libraryKey}/recentlyAdded`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' },
        params: { 'X-Plex-Container-Size': limit }
      });
      
      const items = response.data.MediaContainer.Metadata || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch recently added items: ${error.message}`);
    }
  }

  /**
   * Get similar items
   */
  async getSimilarItems(url, token, itemId) {
    try {
      const response = await axios.get(`${url}/library/metadata/${itemId}/similar`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' }
      });
      
      const items = response.data.MediaContainer.Metadata || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch similar items: ${error.message}`);
    }
  }

  /**
   * Get full item metadata with GUIDs
   */
  async getItemMetadata(url, token, itemId) {
    try {
      const response = await axios.get(`${url}/library/metadata/${itemId}`, {
        headers: { 'X-Plex-Token': token, 'Accept': 'application/json' }
      });
      
      const item = response.data.MediaContainer.Metadata[0];
      return this.normalizeItem(item, true); // Include full metadata
    } catch (error) {
      throw new Error(`Failed to fetch item metadata: ${error.message}`);
    }
  }

  /**
   * Helper: Normalize Plex item to standard format
   */
  normalizeItem(item, includeFullMetadata = false) {
    const guids = this.parseGuids(item.Guid || []);
    
    const normalized = {
      externalId: item.ratingKey,
      title: item.title,
      originalTitle: item.originalTitle,
      year: item.year,
      mediaType: item.type === 'show' ? 'tv' : 'movie',
      genres: (item.Genre || []).map(g => g.tag),
      tags: (item.Label || []).map(l => l.tag),
      collections: (item.Collection || []).map(c => c.tag),
      studio: item.studio,
      contentRating: item.contentRating,
      addedAt: item.addedAt ? new Date(item.addedAt * 1000) : null,
      tmdbId: guids.tmdb,
      imdbId: guids.imdb,
      tvdbId: guids.tvdb
    };

    if (includeFullMetadata) {
      normalized.metadata = item;
    }

    return normalized;
  }

  /**
   * Helper: Parse Plex GUIDs to get TMDB/IMDB/TVDB IDs
   */
  parseGuids(guids) {
    const result = { tmdb: null, imdb: null, tvdb: null };
    
    for (const guid of guids) {
      const id = guid.id || guid;
      if (id.startsWith('tmdb://')) {
        result.tmdb = parseInt(id.replace('tmdb://', ''));
      } else if (id.startsWith('imdb://')) {
        result.imdb = id.replace('imdb://', '');
      } else if (id.startsWith('tvdb://')) {
        result.tvdb = parseInt(id.replace('tvdb://', ''));
      }
    }
    
    return result;
  }
}

module.exports = new PlexService();
