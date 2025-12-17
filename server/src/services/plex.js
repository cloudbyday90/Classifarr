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
        message = 'Invalid Plex token';
      } else if (error.response?.status === 404) {
        code = 'NOT_FOUND';
        message = 'Plex server not found';
      }
      
      return { success: false, error: message, code };
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
}

module.exports = new PlexService();
