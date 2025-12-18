const axios = require('axios');

class RadarrService {
  /**
   * Build URL from config object
   * @param {Object} config - Config with protocol, host, port, base_path
   * @returns {string} Full URL
   */
  buildUrl(config) {
    const protocol = config.protocol || 'http';
    const host = config.host || 'localhost';
    const port = config.port || 7878;
    const basePath = config.base_path || '';
    
    // Ensure base path starts with / if present
    const normalizedPath = basePath && !basePath.startsWith('/') ? `/${basePath}` : basePath;
    
    return `${protocol}://${host}:${port}${normalizedPath}`;
  }

  async testConnection(config) {
    try {
      // Support both old format (url, apiKey) and new format (config object)
      let url, apiKey, timeout;
      if (typeof config === 'string') {
        // Old format: testConnection(url, apiKey)
        url = config;
        apiKey = arguments[1];
        timeout = 5000;
      } else {
        // New format: testConnection(config)
        url = config.url || this.buildUrl(config);
        apiKey = config.api_key;
        timeout = (config.timeout || 30) * 1000;
      }

      const response = await axios.get(`${url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout,
        // SECURITY: Allow disabling SSL verification for self-signed certificates
        // This is controlled by user configuration and is only enabled when verify_ssl is explicitly set to false
        httpsAgent: config && typeof config === 'object' && config.verify_ssl === false ? 
          new (require('https').Agent)({ rejectUnauthorized: false }) : undefined,
      });

      // Get additional stats for detailed response
      // SECURITY: Allow disabling SSL verification for self-signed certificates
      // This is controlled by user configuration and is only enabled when verify_ssl is explicitly set to false
      const httpsAgent = config && typeof config === 'object' && config.verify_ssl === false ? 
        new (require('https').Agent)({ rejectUnauthorized: false }) : undefined;

      const [moviesResponse, rootFoldersResponse, qualityProfilesResponse] = await Promise.allSettled([
        axios.get(`${url}/api/v3/movie`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
        axios.get(`${url}/api/v3/rootfolder`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
        axios.get(`${url}/api/v3/qualityprofile`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
      ]);

      const movieCount = moviesResponse.status === 'fulfilled' ? moviesResponse.value.data.length : 0;
      const rootFolderCount = rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data.length : 0;
      const qualityProfileCount = qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data.length : 0;

      return {
        success: true,
        details: {
          serverName: 'Radarr',
          version: response.data.version,
          status: 'Connected',
          additionalInfo: {
            'Movies': movieCount,
            'Root Folders': rootFolderCount,
            'Quality Profiles': qualityProfileCount,
          },
        },
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.response?.data?.message || error.message,
          code: error.code,
          troubleshooting: [
            'Check that Radarr is running',
            'Verify the URL and port are correct',
            'Ensure the API key is valid',
          ],
        },
      };

      if (error.code === 'ECONNREFUSED') {
        errorResponse.error.troubleshooting.push('Check if a firewall is blocking the connection');
      } else if (error.code === 'ETIMEDOUT') {
        errorResponse.error.troubleshooting.push('Connection timed out - check network connectivity');
      } else if (error.response?.status === 401) {
        errorResponse.error.troubleshooting = ['Invalid API key - check your Radarr settings'];
      } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        errorResponse.error.troubleshooting.push('SSL certificate issue - try disabling SSL verification');
      }

      return errorResponse;
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
