const axios = require('axios');

class SonarrService {
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

      // Get series count
      let seriesCount = 0;
      try {
        const seriesResponse = await axios.get(`${url}/api/v3/series`, {
          headers: {
            'X-Api-Key': key,
          },
          timeout: 5000,
        });
        seriesCount = seriesResponse.data.length;
      } catch (err) {
        console.warn('Could not fetch series count:', err.message);
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

      // Get language profiles (Sonarr v3+)
      let languageProfiles = 0;
      try {
        const langResponse = await axios.get(`${url}/api/v3/languageprofile`, {
          headers: {
            'X-Api-Key': key,
          },
          timeout: 5000,
        });
        languageProfiles = langResponse.data.length;
      } catch (err) {
        // Language profiles might not exist in all versions
        console.warn('Could not fetch language profiles:', err.message);
      }

      return { 
        success: true, 
        version: statusResponse.data.version,
        seriesCount,
        rootFolders,
        qualityProfiles,
        languageProfiles
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

  async addSeries(url, apiKey, seriesData) {
    try {
      const response = await axios.post(`${url}/api/v3/series`, seriesData, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to add series to Sonarr: ${error.message}`);
    }
  }

  async searchSeries(url, apiKey, tvdbId) {
    try {
      const response = await axios.get(`${url}/api/v3/series/lookup`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        params: {
          term: `tvdb:${tvdbId}`,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search series: ${error.message}`);
    }
  }
}

module.exports = new SonarrService();
