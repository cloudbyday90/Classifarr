const axios = require('axios');

class RadarrService {
  buildUrl(config) {
    const { protocol, host, port, base_path } = config;
    const basePath = base_path && base_path.trim() ? base_path.trim() : '';
    return `${protocol}://${host}:${port}${basePath}`;
  }

  async testConnection(config, apiKey) {
    try {
      // Support both object config and separate url/apiKey parameters for backwards compatibility
      let url, key, timeout;
      
      if (typeof config === 'object') {
        url = this.buildUrl(config);
        key = config.api_key;
        timeout = config.timeout ? config.timeout * 1000 : 5000;
      } else {
        // Legacy: config is actually a URL string, apiKey is second parameter
        url = config;
        key = apiKey;
        timeout = 5000;
      }
      
      // Get system status
      const statusResponse = await axios.get(`${url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': key,
        },
        timeout,
      });

      // Get movie count
      let movieCount = 0;
      try {
        const moviesResponse = await axios.get(`${url}/api/v3/movie`, {
          headers: {
            'X-Api-Key': key,
          },
          timeout: 5000,
        });
        movieCount = moviesResponse.data.length;
      } catch (err) {
        console.warn('Could not fetch movie count:', err.message);
      }

      // Get root folders
      let rootFolders = 0;
      try {
        const rootResponse = await axios.get(`${url}/api/v3/rootfolder`, {
          headers: {
            'X-Api-Key': key,
          },
          timeout: 5000,
        });
        rootFolders = rootResponse.data.length;
      } catch (err) {
        console.warn('Could not fetch root folders:', err.message);
      }

      // Get quality profiles
      let qualityProfiles = 0;
      try {
        const profilesResponse = await axios.get(`${url}/api/v3/qualityprofile`, {
          headers: {
            'X-Api-Key': key,
          },
          timeout: 5000,
        });
        qualityProfiles = profilesResponse.data.length;
      } catch (err) {
        console.warn('Could not fetch quality profiles:', err.message);
      }

      return { 
        success: true, 
        version: statusResponse.data.version,
        movieCount,
        rootFolders,
        qualityProfiles
      };
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Unknown error';
      const code = error.code || error.response?.status;
      return { 
        success: false, 
        error: message,
        code
      };
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
}

module.exports = new RadarrService();
