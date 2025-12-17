const axios = require('axios');

/**
 * Sonarr API Service
 * Provides methods to interact with Sonarr
 */

/**
 * Test connection to Sonarr
 * @param {string} host - Sonarr hostname/IP
 * @param {number} port - Sonarr port
 * @param {string} apiKey - Sonarr API key
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/api/v3/system/status`;
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
      timeout: 5000,
    });
    
    return response.status === 200 && response.data;
  } catch (error) {
    console.error('Sonarr connection test failed:', error.message);
    return false;
  }
}

/**
 * Get root folders from Sonarr
 * @param {string} host - Sonarr hostname/IP
 * @param {number} port - Sonarr port
 * @param {string} apiKey - Sonarr API key
 * @returns {Promise<Array>} Array of root folders
 */
async function getRootFolders(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/api/v3/rootfolder`;
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
      timeout: 5000,
    });
    
    return response.data || [];
  } catch (error) {
    console.error('Failed to get Sonarr root folders:', error.message);
    throw new Error(`Failed to retrieve Sonarr root folders: ${error.message}`);
  }
}

/**
 * Get quality profiles from Sonarr
 * @param {string} host - Sonarr hostname/IP
 * @param {number} port - Sonarr port
 * @param {string} apiKey - Sonarr API key
 * @returns {Promise<Array>} Array of quality profiles
 */
async function getQualityProfiles(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/api/v3/qualityprofile`;
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': apiKey,
      },
      timeout: 5000,
    });
    
    return response.data || [];
  } catch (error) {
    console.error('Failed to get Sonarr quality profiles:', error.message);
    throw new Error(`Failed to retrieve Sonarr quality profiles: ${error.message}`);
  }
}

/**
 * Add a series to Sonarr
 * @param {string} host - Sonarr hostname/IP
 * @param {number} port - Sonarr port
 * @param {string} apiKey - Sonarr API key
 * @param {Object} series - Series data object
 * @param {string} rootFolder - Root folder path
 * @param {number} qualityProfile - Quality profile ID
 * @returns {Promise<Object>} Added series data
 */
async function addSeries(host, port, apiKey, series, rootFolder, qualityProfile) {
  try {
    const url = `http://${host}:${port}/api/v3/series`;
    const response = await axios.post(
      url,
      {
        title: series.title,
        tvdbId: series.tvdbId,
        qualityProfileId: qualityProfile,
        rootFolderPath: rootFolder,
        monitored: true,
        seasonFolder: true,
        addOptions: {
          searchForMissingEpisodes: true,
        },
      },
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to add series to Sonarr:', error.message);
    throw new Error(`Failed to add series to Sonarr: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  getRootFolders,
  getQualityProfiles,
  addSeries,
};
