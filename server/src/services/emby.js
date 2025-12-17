const axios = require('axios');

class EmbyService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/System/Info`, {
        headers: { 'X-Emby-Token': apiKey }
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

  async getLibraries(url, apiKey) {
    try {
      const response = await axios.get(`${url}/Library/VirtualFolders`, {
        headers: { 'X-Emby-Token': apiKey }
      });

      const libraries = response.data.map(lib => ({
        key: lib.ItemId,
        title: lib.Name,
        type: this.mapEmbyType(lib.CollectionType),
        location: lib.Locations?.[0] || ''
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

  mapEmbyType(embyType) {
    const typeMap = {
      'movies': 'movie',
      'tvshows': 'tv',
      'music': 'music'
    };
    return typeMap[embyType] || 'mixed';
  }

  async syncLibraries(serverId, url, apiKey) {
    const result = await this.getLibraries(url, apiKey);
    if (!result.success) {
      throw new Error(result.error);
    }

    return result.libraries;
  }
}

module.exports = new EmbyService();
