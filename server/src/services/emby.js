const axios = require('axios');

class EmbyService {
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
      throw new Error(`Failed to fetch Emby libraries: ${error.message}`);
    }
  }

  /**
   * Get library items with pagination
   */
  async getLibraryItems(url, apiKey, libraryKey, options = {}) {
    const { offset = 0, limit = 100 } = options;
    
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        params: {
          ParentId: libraryKey,
          Recursive: true,
          IncludeItemTypes: 'Movie,Series',
          StartIndex: offset,
          Limit: limit,
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated,Overview',
        },
      });

      const items = response.data.Items || [];
      return items.map(item => this.mapEmbyItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch Emby library items: ${error.message}`);
    }
  }

  /**
   * Get collections for a library
   */
  async getCollections(url, apiKey, libraryKey) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        params: {
          ParentId: libraryKey,
          Recursive: false,
          IncludeItemTypes: 'BoxSet',
        },
      });

      const collections = response.data.Items || [];
      return collections.map(col => ({
        external_id: col.Id,
        name: col.Name,
        description: col.Overview || '',
        item_count: col.ChildCount || 0,
        poster_url: col.ImageTags?.Primary 
          ? `${url}/Items/${col.Id}/Images/Primary` 
          : null,
        metadata: {
          added_at: col.DateCreated,
        },
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Search for media by TMDB ID
   */
  async searchByProviderIds(url, apiKey, tmdbId) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: {
          'X-Emby-Token': apiKey,
        },
        params: {
          Recursive: true,
          AnyProviderIdEquals: `tmdb.${tmdbId}`,
          Limit: 1,
        },
      });

      const items = response.data.Items || [];
      if (items.length > 0) {
        return this.mapEmbyItem(items[0]);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse Emby provider IDs
   */
  parseGuids(item) {
    const ids = {
      tmdb_id: null,
      imdb_id: null,
      tvdb_id: null,
    };

    if (!item.ProviderIds) return ids;

    if (item.ProviderIds.Tmdb) {
      ids.tmdb_id = parseInt(item.ProviderIds.Tmdb);
    }
    if (item.ProviderIds.Imdb) {
      ids.imdb_id = item.ProviderIds.Imdb;
    }
    if (item.ProviderIds.Tvdb) {
      ids.tvdb_id = parseInt(item.ProviderIds.Tvdb);
    }

    return ids;
  }

  /**
   * Map Emby item to standard format
   */
  mapEmbyItem(item) {
    const ids = this.parseGuids(item);
    
    return {
      external_id: item.Id,
      ...ids,
      title: item.Name,
      original_title: item.OriginalTitle || null,
      year: item.ProductionYear || null,
      media_type: item.Type === 'Series' ? 'tv' : 'movie',
      genres: item.Genres || [],
      tags: item.Tags || [],
      collections: [], // Emby doesn't provide this in item data
      studio: (item.Studios && item.Studios[0]) ? item.Studios[0].Name : null,
      content_rating: item.OfficialRating || null,
      added_at: item.DateCreated ? new Date(item.DateCreated) : null,
      metadata: {
        summary: item.Overview,
        community_rating: item.CommunityRating,
        critic_rating: item.CriticRating,
        runtime: item.RunTimeTicks ? item.RunTimeTicks / 10000000 / 60 : null,
      },
    };
  }
}

module.exports = new EmbyService();
