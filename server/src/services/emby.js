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
   * Get all items in a library with pagination
   */
  async getLibraryItems(url, apiKey, libraryId, options = {}) {
    try {
      const { offset = 0, limit = 100 } = options;
      const response = await axios.get(`${url}/Items`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          ParentId: libraryId,
          IncludeItemTypes: 'Movie,Series',
          Recursive: true,
          StartIndex: offset,
          Limit: limit,
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated'
        }
      });
      
      const items = response.data.Items || [];
      return {
        items: items.map(item => this.normalizeItem(item)),
        totalCount: response.data.TotalRecordCount || items.length,
        offset,
        limit
      };
    } catch (error) {
      throw new Error(`Failed to fetch Emby library items: ${error.message}`);
    }
  }

  /**
   * Get all collections in a library
   */
  async getCollections(url, apiKey, parentId) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          ParentId: parentId,
          IncludeItemTypes: 'BoxSet',
          Recursive: true
        }
      });
      
      const collections = response.data.Items || [];
      return collections.map(col => ({
        id: col.Id,
        name: col.Name,
        itemCount: col.ChildCount || 0,
        thumb: col.ImageTags?.Primary ? `${url}/Items/${col.Id}/Images/Primary` : null
      }));
    } catch (error) {
      throw new Error(`Failed to fetch Emby collections: ${error.message}`);
    }
  }

  /**
   * Get items in a collection
   */
  async getCollectionItems(url, apiKey, collectionId) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          ParentId: collectionId,
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated'
        }
      });
      
      const items = response.data.Items || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch Emby collection items: ${error.message}`);
    }
  }

  /**
   * Search for item by provider IDs (TMDB/IMDB/TVDB)
   */
  async searchByProviderIds(url, apiKey, tmdbId) {
    try {
      const response = await axios.get(`${url}/Items`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          AnyProviderIdEquals: `tmdb.${tmdbId}`,
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated'
        }
      });
      
      const items = response.data.Items || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to search Emby by provider IDs: ${error.message}`);
    }
  }

  /**
   * Get recently added items
   */
  async getRecentlyAdded(url, apiKey, libraryId, limit = 50) {
    try {
      const response = await axios.get(`${url}/Items/Latest`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          ParentId: libraryId,
          Limit: limit,
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated'
        }
      });
      
      const items = response.data || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch recently added items: ${error.message}`);
    }
  }

  /**
   * Get similar items
   */
  async getSimilarItems(url, apiKey, itemId) {
    try {
      const response = await axios.get(`${url}/Items/${itemId}/Similar`, {
        headers: { 'X-Emby-Token': apiKey },
        params: {
          Fields: 'ProviderIds,Genres,Tags,Studios,OfficialRating,DateCreated'
        }
      });
      
      const items = response.data.Items || [];
      return items.map(item => this.normalizeItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch similar items: ${error.message}`);
    }
  }

  /**
   * Helper: Normalize Emby item to standard format
   */
  normalizeItem(item, includeFullMetadata = false) {
    const providerIds = item.ProviderIds || {};
    
    const normalized = {
      externalId: item.Id,
      title: item.Name,
      originalTitle: item.OriginalTitle,
      year: item.ProductionYear,
      mediaType: item.Type === 'Series' ? 'tv' : 'movie',
      genres: (item.Genres || []),
      tags: (item.Tags || []),
      collections: [], // Emby doesn't expose collections in item metadata directly
      studio: (item.Studios || [])[0]?.Name,
      contentRating: item.OfficialRating,
      addedAt: item.DateCreated ? new Date(item.DateCreated) : null,
      tmdbId: providerIds.Tmdb ? parseInt(providerIds.Tmdb) : null,
      imdbId: providerIds.Imdb || null,
      tvdbId: providerIds.Tvdb ? parseInt(providerIds.Tvdb) : null
    };

    if (includeFullMetadata) {
      normalized.metadata = item;
    }

    return normalized;
  }
}

module.exports = new EmbyService();
