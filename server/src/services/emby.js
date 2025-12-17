const axios = require('axios');

/**
 * Emby API Service
 * Provides methods to interact with Emby Media Server
 */

/**
 * Test connection to Emby server
 * @param {string} host - Emby server hostname/IP
 * @param {number} port - Emby server port
 * @param {string} apiKey - Emby API key
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/System/Info`;
    const response = await axios.get(url, {
      headers: {
        'X-Emby-Token': apiKey,
      },
      timeout: 5000,
    });
    
    return response.status === 200 && response.data;
  } catch (error) {
    console.error('Emby connection test failed:', error.message);
    return false;
  }
}

/**
 * Get all libraries from Emby server
 * @param {string} host - Emby server hostname/IP
 * @param {number} port - Emby server port
 * @param {string} apiKey - Emby API key
 * @returns {Promise<Array>} Array of libraries with id, name, type, path
 */
async function getLibraries(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/Library/VirtualFolders`;
    const response = await axios.get(url, {
      headers: {
        'X-Emby-Token': apiKey,
      },
      timeout: 10000,
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }

    // Map Emby libraries to our standard format
    return response.data.map(library => ({
      id: library.ItemId,
      name: library.Name,
      type: library.CollectionType || 'unknown', // movies, tvshows, etc.
      path: library.Locations?.[0] || '',
    }));
  } catch (error) {
    console.error('Failed to get Emby libraries:', error.message);
    throw new Error(`Failed to retrieve Emby libraries: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  getLibraries,
};
