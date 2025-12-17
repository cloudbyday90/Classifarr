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
}

module.exports = new PlexService();
