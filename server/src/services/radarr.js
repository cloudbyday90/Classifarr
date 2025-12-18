const axios = require('axios');

class RadarrService {
  async testConnection(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout: 5000,
      });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getRootFolders(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/rootfolder`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch root folders: ${error.message}`);
    }
  }

  async getQualityProfiles(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/qualityprofile`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch quality profiles: ${error.message}`);
    }
  }

  async addMovie(url, apiKey, movieData) {
    try {
      const response = await axios.post(`${url}/api/v3/movie`, movieData, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add movie to Radarr: ${error.message}`);
    }
  }

  async searchMovie(url, apiKey, tmdbId) {
    try {
      const response = await axios.get(`${url}/api/v3/movie/lookup/tmdb`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        params: {
          tmdbId,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search movie: ${error.message}`);
    }
  }

  async getTags(url, apiKey) {
    try {
      const response = await axios.get(`${url}/api/v3/tag`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data.map(tag => ({ id: tag.id, label: tag.label }));
    } catch (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }
  }

  getMinimumAvailabilityOptions() {
    return [
      { value: 'announced', label: 'Announced', description: 'Search as soon as announced' },
      { value: 'inCinemas', label: 'In Cinemas', description: 'Search when in theaters' },
      { value: 'released', label: 'Released', description: 'Search when released' },
      { value: 'preDB', label: 'PreDB', description: 'Search when in PreDB' }
    ];
  }
}

module.exports = new RadarrService();
