const axios = require('axios');

/**
 * Plex API Service
 * Provides methods to interact with Plex Media Server
 */

/**
 * Test connection to Plex server
 * @param {string} host - Plex server hostname/IP
 * @param {number} port - Plex server port
 * @param {string} token - Plex authentication token
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection(host, port, token) {
  try {
    const url = `http://${host}:${port}/identity`;
    const response = await axios.get(url, {
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
      },
      timeout: 5000,
    });
    
    return response.status === 200 && response.data;
  } catch (error) {
    console.error('Plex connection test failed:', error.message);
    return false;
  }
}

/**
 * Get all libraries from Plex server
 * @param {string} host - Plex server hostname/IP
 * @param {number} port - Plex server port
 * @param {string} token - Plex authentication token
 * @returns {Promise<Array>} Array of libraries with id, name, type, path
 */
async function getLibraries(host, port, token) {
  try {
    const url = `http://${host}:${port}/library/sections`;
    const response = await axios.get(url, {
      headers: {
        'X-Plex-Token': token,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    
    if (!response.data || !response.data.MediaContainer || !response.data.MediaContainer.Directory) {
      return [];
    }

    // Map Plex libraries to our standard format
    return response.data.MediaContainer.Directory.map(library => ({
      id: library.key,
      name: library.title,
      type: library.type, // movie, show, etc.
      path: library.Location?.[0]?.path || '',
    }));
  } catch (error) {
    console.error('Failed to get Plex libraries:', error.message);
    throw new Error(`Failed to retrieve Plex libraries: ${error.message}`);
  }
}

module.exports = {
  testConnection,
  getLibraries,
};
