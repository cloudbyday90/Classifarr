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
      let code = 'CONNECTION_ERROR';
      let message = error.message;
      
      if (error.code === 'ECONNREFUSED') {
        code = 'ECONNREFUSED';
        message = 'Connection refused';
      } else if (error.code === 'ETIMEDOUT') {
        code = 'ETIMEDOUT';
        message = 'Connection timed out';
      } else if (error.response?.status === 401) {
        code = 'UNAUTHORIZED';
        message = 'Invalid API key';
      } else if (error.response?.status === 404) {
        code = 'NOT_FOUND';
        message = 'Jellyfin server not found';
      }
      
      return { success: false, error: message, code };
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
}

module.exports = new JellyfinService();
