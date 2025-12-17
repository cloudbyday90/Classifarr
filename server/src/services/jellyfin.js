const axios = require('axios');

/**
 * Jellyfin API Service
 * Provides methods to interact with Jellyfin Media Server
 */

/**
 * Test connection to Jellyfin server
 * @param {string} host - Jellyfin server hostname/IP
 * @param {number} port - Jellyfin server port
 * @param {string} apiKey - Jellyfin API key
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/System/Info/Public`;
    const response = await axios.get(url, {
      headers: {
        'X-Emby-Token': apiKey, // Jellyfin uses same header as Emby
      },
      timeout: 5000,
    });
    
    return response.status === 200 && response.data;
  } catch (error) {
    console.error('Jellyfin connection test failed:', error.message);
    return false;
  }
}

/**
 * Get all libraries from Jellyfin server
 * @param {string} host - Jellyfin server hostname/IP
 * @param {number} port - Jellyfin server port
 * @param {string} apiKey - Jellyfin API key
 * @returns {Promise<Array>} Array of libraries with id, name, type, path
 */
async function getLibraries(host, port, apiKey) {
  try {
    const url = `http://${host}:${port}/Library/VirtualFolders`;
    const response = await axios.get(url, {
      headers: {
        'X-Emby-Token': apiKey, // Jellyfin uses same header as Emby
      },
      timeout: 10000,
    });
    
    if (!response.data || !Array.isArray(response.data)) {
      return [];
    }

    // Map Jellyfin libraries to our standard format
    return response.data.map(library => ({
      id: library.ItemId,
      name: library.Name,
      type: library.CollectionType || 'unknown', // movies, tvshows, etc.
      path: library.Locations?.[0] || '',
    }));
  } catch (error) {
    console.error('Failed to get Jellyfin libraries:', error.message);
    throw new Error(`Failed to retrieve Jellyfin libraries: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  getLibraries,
};
