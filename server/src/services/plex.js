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
   * Get library items with pagination
   */
  async getLibraryItems(url, apiKey, libraryKey, options = {}) {
    const { offset = 0, limit = 100 } = options;
    
    try {
      const response = await axios.get(
        `${url}/library/sections/${libraryKey}/all`,
        {
          headers: {
            'X-Plex-Token': apiKey,
            'Accept': 'application/json',
          },
          params: {
            'X-Plex-Container-Start': offset,
            'X-Plex-Container-Size': limit,
          },
        }
      );

      const items = response.data.MediaContainer.Metadata || [];
      return items.map(item => this.mapPlexItem(item));
    } catch (error) {
      throw new Error(`Failed to fetch Plex library items: ${error.message}`);
    }
  }

  /**
   * Get collections for a library
   */
  async getCollections(url, apiKey, libraryKey) {
    try {
      const response = await axios.get(
        `${url}/library/sections/${libraryKey}/collections`,
        {
          headers: {
            'X-Plex-Token': apiKey,
            'Accept': 'application/json',
          },
        }
      );

      const collections = response.data.MediaContainer.Metadata || [];
      return collections.map(col => ({
        external_id: col.ratingKey,
        name: col.title,
        description: col.summary || '',
        item_count: col.childCount || 0,
        poster_url: col.thumb ? `${url}${col.thumb}` : null,
        metadata: {
          added_at: col.addedAt,
          updated_at: col.updatedAt,
        },
      }));
    } catch (error) {
      // Collections might not be available for all libraries
      return [];
    }
  }

  /**
   * Search for media by TMDB ID
   */
  async searchByProviderIds(url, apiKey, tmdbId) {
    try {
      const response = await axios.get(`${url}/library/all`, {
        headers: {
          'X-Plex-Token': apiKey,
          'Accept': 'application/json',
        },
        params: {
          guid: `tmdb://${tmdbId}`,
        },
      });

      const items = response.data.MediaContainer.Metadata || [];
      if (items.length > 0) {
        return this.mapPlexItem(items[0]);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse Plex GUIDs to extract provider IDs
   */
  parseGuids(item) {
    const ids = {
      tmdb_id: null,
      imdb_id: null,
      tvdb_id: null,
    };

    if (!item.Guid) return ids;

    const guids = Array.isArray(item.Guid) ? item.Guid : [item.Guid];
    
    for (const guid of guids) {
      const id = guid.id || '';
      
      if (id.includes('tmdb://')) {
        ids.tmdb_id = parseInt(id.split('tmdb://')[1]);
      } else if (id.includes('imdb://')) {
        ids.imdb_id = id.split('imdb://')[1];
      } else if (id.includes('tvdb://')) {
        ids.tvdb_id = parseInt(id.split('tvdb://')[1]);
      }
    }

    return ids;
  }

  /**
   * Map Plex item to standard format
   */
  mapPlexItem(item) {
    const ids = this.parseGuids(item);
    
    return {
      external_id: item.ratingKey,
      ...ids,
      title: item.title,
      original_title: item.originalTitle || null,
      year: item.year || null,
      media_type: item.type === 'show' ? 'tv' : 'movie',
      genres: (item.Genre || []).map(g => g.tag),
      tags: (item.Label || []).map(l => l.tag),
      collections: (item.Collection || []).map(c => c.tag),
      studio: item.studio || null,
      content_rating: item.contentRating || null,
      added_at: item.addedAt ? new Date(item.addedAt * 1000) : null,
      metadata: {
        summary: item.summary,
        rating: item.rating,
        audience_rating: item.audienceRating,
        duration: item.duration,
      },
    };
  }
}

module.exports = new PlexService();
