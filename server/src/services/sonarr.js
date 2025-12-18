const axios = require('axios');

class SonarrService {
  /**
   * Build URL from config object
   * @param {Object} config - Config with protocol, host, port, base_path
   * @returns {string} Full URL
   */
  buildUrl(config) {
    const protocol = config.protocol || 'http';
    const host = config.host || 'localhost';
    const port = config.port || 8989;
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

      const [seriesResponse, rootFoldersResponse, qualityProfilesResponse, languageProfilesResponse] = await Promise.allSettled([
        axios.get(`${url}/api/v3/series`, {
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
        axios.get(`${url}/api/v3/languageprofile`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }).catch(() => ({ status: 'rejected' })), // Language profiles may not exist in newer versions
      ]);

      const seriesCount = seriesResponse.status === 'fulfilled' ? seriesResponse.value.data.length : 0;
      const rootFolderCount = rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data.length : 0;
      const qualityProfileCount = qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data.length : 0;
      const languageProfileCount = languageProfilesResponse.status === 'fulfilled' ? languageProfilesResponse.value.data.length : 0;

      const additionalInfo = {
        'Series': seriesCount,
        'Root Folders': rootFolderCount,
        'Quality Profiles': qualityProfileCount,
      };

      if (languageProfileCount > 0) {
        additionalInfo['Language Profiles'] = languageProfileCount;
      }

      return {
        success: true,
        details: {
          serverName: 'Sonarr',
          version: response.data.version,
          status: 'Connected',
          additionalInfo,
        },
      };
    } catch (error) {
      const errorResponse = {
        success: false,
        error: {
          message: error.response?.data?.message || error.message,
          code: error.code,
          troubleshooting: [
            'Check that Sonarr is running',
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
        errorResponse.error.troubleshooting = ['Invalid API key - check your Sonarr settings'];
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
