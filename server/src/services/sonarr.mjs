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

class SonarrService {
  buildUrl(config) {
    const protocol = config.protocol || 'http';
    const host = config.host || 'localhost';
    const port = config.port || 8989;
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

      const [systemStatusResponse, qualityProfilesResponse, rootFoldersResponse] = await Promise.allSettled([
        axios.get(`${url}/api/v3/system/status`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
        axios.get(`${url}/api/v3/qualityprofile`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
        axios.get(`${url}/api/v3/rootfolder`, {
          headers: { 'X-Api-Key': apiKey },
          timeout,
          httpsAgent,
        }),
      ]);

      const additionalInfo = {};

      return {
        success: true,
        details: {
          serverName: 'Sonarr',
          version: systemStatusResponse.status === 'fulfilled' ? systemStatusResponse.value.data.version : 'Unknown',
          status: 'Connected',
          additionalInfo,
        },
        data: {
          qualityProfiles: qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data : [],
          rootFolders: rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data : [],
          seriesTypeOptions: this.getSeriesTypeOptions(),
          seasonMonitoringOptions: this.getSeasonMonitoringOptions()
        }
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
        error: `Path "${destinationPath}" is not within any configured Sonarr root folder`
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Failed to validate root folder: ${error.message}`,
        destinationPath
      };
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
      if (error.response?.status === 409) {
        return { alreadyExists: true };
      }
      if (error.response?.status === 400) {
        const body = error.response.data;
        const msgs = Array.isArray(body)
          ? body.map(e => `${e.errorCode || ''} ${e.errorMessage || ''}`).join(' ')
          : String(body || '');
        if (/already been added/i.test(msgs) || /SeriesExistsValidator/i.test(msgs)) {
          return { alreadyExists: true };
        }
      }
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

  async getSeriesByTvdbId(url, apiKey, tvdbId) {
    try {
      const response = await axios.get(`${url}/api/v3/series`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });

      const series = response.data.find(s => s.tvdbId === parseInt(tvdbId));
      return series || null;
    } catch (error) {
      throw new Error(`Failed to find series by TVDB ID: ${error.message}`);
    }
  }

  async updateSeriesPath(url, apiKey, seriesId, newPath, options = {}) {
    const { moveFiles = false, qualityProfileId = null } = options;

    try {
      const series = await this.getSeriesById(url, apiKey, seriesId);
      if (!series) {
        throw new Error(`Series not found with ID: ${seriesId}`);
      }

      const pathParts = newPath.replace(/\/$/, '').split('/');
      const _titleFolder = pathParts.pop();
      const newRootFolderPath = pathParts.join('/');

      const updateData = {
        ...series,
        path: newPath,
        rootFolderPath: newRootFolderPath,
      };

      if (qualityProfileId) {
        updateData.qualityProfileId = qualityProfileId;
      }

      const updateResponse = await axios.put(
        `${url}/api/v3/series/${seriesId}?moveFiles=${moveFiles}`,
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
      throw new Error(`Failed to update series path: ${error.message}`);
    }
  }

  async getSeriesById(url, apiKey, seriesId) {
    try {
      const response = await axios.get(`${url}/api/v3/series/${seriesId}`, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to get series: ${error.message}`);
    }
  }

  getSeriesTypeOptions() {
    return [
      { value: 'standard', label: 'Standard', description: 'S##E## numbering' },
      { value: 'anime', label: 'Anime', description: 'Absolute episode numbering' },
      { value: 'daily', label: 'Daily', description: 'Date-based episodes' }
    ];
  }

  getSeasonMonitoringOptions() {
    return [
      { value: 'all', label: 'All Episodes', description: 'Monitor all episodes except specials' },
      { value: 'future', label: 'Future Seasons', description: 'Only future seasons' },
      { value: 'missing', label: 'Missing Episodes', description: 'Missing in all seasons' },
      { value: 'existing', label: 'Existing Episodes', description: 'Only existing' },
      { value: 'recent', label: 'Recent Episodes', description: 'Recent only' },
      { value: 'pilot', label: 'Pilot Only', description: 'Only pilot episode' },
      { value: 'firstSeason', label: 'First Season', description: 'First season only' },
      { value: 'latestSeason', label: 'Latest Season', description: 'Latest season only' },
      { value: 'none', label: 'None', description: 'Don\'t monitor' }
    ];
  }
}

export default new SonarrService();
