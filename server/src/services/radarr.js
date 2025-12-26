/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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

  /**
   * Validate that a destination path is within a configured root folder
   * @param {string} url - Radarr URL
   * @param {string} apiKey - API key
   * @param {string} destinationPath - The path to validate
   * @returns {Object} Validation result with isValid and matchedRootFolder
   */
  async validatePathInRootFolder(url, apiKey, destinationPath) {
    try {
      const rootFolders = await this.getRootFolders(url, apiKey);

      // Normalize paths for comparison (handle trailing slashes)
      const normalizedDest = destinationPath.replace(/[/\\]+$/, '');

      for (const folder of rootFolders) {
        const normalizedRoot = folder.path.replace(/[/\\]+$/, '');

        // Check if destination starts with this root folder
        if (normalizedDest.startsWith(normalizedRoot + '/') ||
          normalizedDest.startsWith(normalizedRoot + '\\') ||
          normalizedDest === normalizedRoot) {
          return {
            isValid: true,
            matchedRootFolder: folder.path,
            freeSpace: folder.freeSpace,
            destinationPath
          };
        }
      }

      return {
        isValid: false,
        availableRootFolders: rootFolders.map(f => f.path),
        destinationPath,
        error: `Path "${destinationPath}" is not within any configured Radarr root folder`
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate root folder: ${error.message}`,
        destinationPath
      };
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

  /**
   * Get a movie by TMDB ID (from Radarr's library)
   * @param {string} url - Radarr URL
   * @param {string} apiKey - API key
   * @param {number} tmdbId - TMDB ID
   * @returns {Object|null} Movie object or null if not found
   */
  async getMovieByTmdbId(url, apiKey, tmdbId) {
    try {
      const response = await axios.get(`${url}/api/v3/movie`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });

      const movie = response.data.find(m => m.tmdbId === parseInt(tmdbId));
      return movie || null;
    } catch (error) {
      throw new Error(`Failed to find movie by TMDB ID: ${error.message}`);
    }
  }

  /**
   * Update a movie's path in Radarr
   * When moveFiles=false, Radarr only updates its database (Classifarr handles the actual move)
   * When moveFiles=true, Radarr moves the files itself (legacy behavior)
   * 
   * @param {string} url - Radarr URL
   * @param {string} apiKey - API key
   * @param {number} movieId - Radarr movie ID
   * @param {string} newPath - New absolute path for the movie folder
   * @param {Object} options - Update options
   * @param {boolean} options.moveFiles - Whether Radarr should move files (default: false)
   * @param {number} options.qualityProfileId - Quality profile ID (optional)
   * @returns {Object} Updated movie object
   */
  async updateMoviePath(url, apiKey, movieId, newPath, options = {}) {
    const { moveFiles = false, qualityProfileId = null } = options;

    try {
      // First, get the current movie data
      const movie = await this.getMovieById(url, apiKey, movieId);
      if (!movie) {
        throw new Error(`Movie not found with ID: ${movieId}`);
      }

      // Extract root folder from new path
      // If newPath is "/movies/4k/The Matrix (1999)", root is "/movies/4k"
      const pathParts = newPath.replace(/\/$/, '').split('/');
      const titleFolder = pathParts.pop();
      const newRootFolderPath = pathParts.join('/');

      // Update the movie with new path
      const updateData = {
        ...movie,
        path: newPath,
        rootFolderPath: newRootFolderPath,
      };

      if (qualityProfileId) {
        updateData.qualityProfileId = qualityProfileId;
      }

      // PUT request with moveFiles query parameter
      const updateResponse = await axios.put(
        `${url}/api/v3/movie/${movieId}?moveFiles=${moveFiles}`,
        updateData,
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      return updateResponse.data;
    } catch (error) {
      throw new Error(`Failed to update movie path: ${error.message}`);
    }
  }

  /**
   * Get a movie by its Radarr internal ID
   * @param {string} url - Radarr URL
   * @param {string} apiKey - API key
   * @param {number} movieId - Radarr movie ID
   * @returns {Object|null} Movie object or null
   */
  async getMovieById(url, apiKey, movieId) {
    try {
      const response = await axios.get(`${url}/api/v3/movie/${movieId}`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get movie: ${error.message}`);
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
