const axios = require('axios');

/**
 * Radarr API Service
 * Provides methods to interact with Radarr
 */

/**
 * Test connection to Radarr
 * @param {string} host - Radarr hostname/IP
 * @param {number} port - Radarr port
 * @param {string} apiKey - Radarr API key
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
    console.error('Radarr connection test failed:', error.message);
    return false;
  }
}

/**
 * Get root folders from Radarr
 * @param {string} host - Radarr hostname/IP
 * @param {number} port - Radarr port
 * @param {string} apiKey - Radarr API key
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
    console.error('Failed to get Radarr root folders:', error.message);
    throw new Error(`Failed to retrieve Radarr root folders: ${error.message}`);
  }
}

/**
 * Get quality profiles from Radarr
 * @param {string} host - Radarr hostname/IP
 * @param {number} port - Radarr port
 * @param {string} apiKey - Radarr API key
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
    console.error('Failed to get Radarr quality profiles:', error.message);
    throw new Error(`Failed to retrieve Radarr quality profiles: ${error.message}`);
  }
}

/**
 * Add a movie to Radarr
 * @param {string} host - Radarr hostname/IP
 * @param {number} port - Radarr port
 * @param {string} apiKey - Radarr API key
 * @param {Object} movie - Movie data object
 * @param {string} rootFolder - Root folder path
 * @param {number} qualityProfile - Quality profile ID
 * @returns {Promise<Object>} Added movie data
 */
async function addMovie(host, port, apiKey, movie, rootFolder, qualityProfile) {
  try {
    const url = `http://${host}:${port}/api/v3/movie`;
    const response = await axios.post(
      url,
      {
        title: movie.title,
        tmdbId: movie.tmdbId,
        year: movie.year,
        qualityProfileId: qualityProfile,
        rootFolderPath: rootFolder,
        monitored: true,
        addOptions: {
          searchForMovie: true,
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
    console.error('Failed to add movie to Radarr:', error.message);
    throw new Error(`Failed to add movie to Radarr: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  getRootFolders,
  getQualityProfiles,
  addMovie,
};
