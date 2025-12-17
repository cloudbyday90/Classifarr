const axios = require('axios');

class PlexService {
  async testConnection(url, token) {
    try {
      const response = await axios.get(`${url}/identity`, {
        headers: { 'X-Plex-Token': token }
      });
      return {
        success: true,
        data: response.data
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  async getLibraries(url, token) {
    try {
      const response = await axios.get(`${url}/library/sections`, {
        headers: { 
          'X-Plex-Token': token,
          'Accept': 'application/json'
        }
      });

      const libraries = response.data.MediaContainer.Directory.map(lib => ({
        key: lib.key,
        title: lib.title,
        type: this.mapPlexType(lib.type),
        location: lib.Location?.[0]?.path || ''
      }));

      return {
        success: true,
        libraries
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }

  mapPlexType(plexType) {
    const typeMap = {
      'movie': 'movie',
      'show': 'tv',
      'artist': 'music'
    };
    return typeMap[plexType] || 'mixed';
  }

  async syncLibraries(serverId, url, token) {
    const result = await this.getLibraries(url, token);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.libraries;
  }
}

module.exports = new PlexService();
