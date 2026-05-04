/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import axios from 'axios';
import https from 'node:https';

class RadarrService {
  buildUrl(config) {
    const protocol = config.protocol || 'http';
    const host = config.host || 'localhost';
    const port = config.port || 7878;
    const basePath = config.base_path || '';
    const normalizedPath = basePath && !basePath.startsWith('/') ? `/${basePath}` : basePath;
    return `${protocol}://${host}:${port}${normalizedPath}`;
  }

  async testConnection(config) {
    try {
      let url, apiKey, timeout;
      if (typeof config === 'string') {
        url = config;
        apiKey = arguments[1];
        timeout = 5000;
      } else {
        url = config.url || this.buildUrl(config);
        apiKey = config.api_key;
        timeout = (config.timeout || 30) * 1000;
      }

      const _response = await axios.get(`${url}/api/v3/system/status`, {
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout,
        httpsAgent: config && typeof config === 'object' && config.verify_ssl === false ?
          new https.Agent({ rejectUnauthorized: false }) : undefined,
      });

      const httpsAgent = config && typeof config === 'object' && config.verify_ssl === false ?
        new https.Agent({ rejectUnauthorized: false }) : undefined;

      const client = axios.create({
        baseURL: url,
        headers: {
          'X-Api-Key': apiKey,
        },
        timeout,
        httpsAgent,
      });

      const [systemStatusResponse, qualityProfilesResponse, rootFoldersResponse] = await Promise.allSettled([
        client.get('/api/v3/system/status'),
        client.get('/api/v3/qualityprofile'),
        client.get('/api/v3/rootfolder'),
      ]);

      const rootFolderCount = rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data.length : 0;
      const qualityProfileCount = qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data.length : 0;

      return {
        success: true,
        details: {
          radarr_version: systemStatusResponse.status === 'fulfilled' ? systemStatusResponse.value.data.version : 'Unknown',
          status: 'Connected',
          additionalInfo: {
            'Root Folders': rootFolderCount,
            'Quality Profiles': qualityProfileCount,
          },
        },
        data: {
          qualityProfiles: qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data : [],
          rootFolders: rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data : [],
          minimumAvailabilityOptions: this.getMinimumAvailabilityOptions()
        }
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

  async validatePathInRootFolder(url, apiKey, destinationPath) {
    try {
      const rootFolders = await this.getRootFolders(url, apiKey);
      const normalizedDest = destinationPath.replace(/[/\\]+$/, '');

      for (const folder of rootFolders) {
        const normalizedRoot = folder.path.replace(/[/\\]+$/, '');
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
      if (error.response?.status === 409) {
        return { alreadyExists: true };
      }
      if (error.response?.status === 400) {
        const body = error.response.data;
        const msgs = Array.isArray(body)
          ? body.map(e => `${e.errorCode || ''} ${e.errorMessage || ''}`).join(' ')
          : String(body || '');
        if (/MovieExistsValidator/i.test(msgs) || /already (been |)added/i.test(msgs)) {
          return { alreadyExists: true };
        }
      }
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

  async updateMoviePath(url, apiKey, movieId, newPath, options = {}) {
    const { moveFiles = false, qualityProfileId = null } = options;

    try {
      const movie = await this.getMovieById(url, apiKey, movieId);
      if (!movie) {
        throw new Error(`Movie not found with ID: ${movieId}`);
      }

      const pathParts = newPath.replace(/\/$/, '').split('/');
      const _titleFolder = pathParts.pop();
      const newRootFolderPath = pathParts.join('/');

      const updateData = {
        ...movie,
        path: newPath,
        rootFolderPath: newRootFolderPath,
      };

      if (qualityProfileId) {
        updateData.qualityProfileId = qualityProfileId;
      }

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

export default new RadarrService();
