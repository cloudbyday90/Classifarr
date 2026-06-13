/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpGet, httpPost, httpPut } from '../utils/httpClient.mjs';
import { createArrBaseMethods } from './arrServiceBase.mjs';
import { NotFoundError } from '../utils/appError.mjs';

class SonarrService {
  constructor() {
    Object.assign(this, createArrBaseMethods({ httpGet, serviceName: 'Sonarr' }));
  }
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

      const rejectUnauthorized = !(config && typeof config === 'object' && config.verify_ssl === false);
      const reqOpts = { headers: { 'X-Api-Key': apiKey }, timeout, rejectUnauthorized };

      // Probe call — throws on connection error / 401
      await httpGet(`${url}/api/v3/system/status`, reqOpts);

      const [systemStatusResponse, qualityProfilesResponse, rootFoldersResponse] = await Promise.allSettled([
        httpGet(`${url}/api/v3/system/status`, reqOpts),
        httpGet(`${url}/api/v3/qualityprofile`, reqOpts),
        httpGet(`${url}/api/v3/rootfolder`, reqOpts),
      ]);

      const rootFolderCount = rootFoldersResponse.status === 'fulfilled' ? rootFoldersResponse.value.data.length : 0;
      const qualityProfileCount = qualityProfilesResponse.status === 'fulfilled' ? qualityProfilesResponse.value.data.length : 0;
      const additionalInfo = {
        'Root Folders': rootFolderCount,
        'Quality Profiles': qualityProfileCount,
      };

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

  async addSeries(url, apiKey, seriesData) {
    try {
      const response = await httpPost(`${url}/api/v3/series`, seriesData, {
        headers: { 'X-Api-Key': apiKey },
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
      const response = await httpGet(`${url}/api/v3/series/lookup`, {
        headers: { 'X-Api-Key': apiKey },
        params: { term: `tvdb:${tvdbId}` },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to search series: ${error.message}`);
    }
  }

  async getSeriesByTvdbId(url, apiKey, tvdbId) {
    try {
      const response = await httpGet(`${url}/api/v3/series`, {
        headers: { 'X-Api-Key': apiKey },
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
        throw new NotFoundError(`Series not found with ID: ${seriesId}`);
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

      const updateResponse = await httpPut(
        `${url}/api/v3/series/${seriesId}?moveFiles=${moveFiles}`,
        updateData,
        { headers: { 'X-Api-Key': apiKey } },
      );

      return updateResponse.data;
    } catch (error) {
      throw new Error(`Failed to update series path: ${error.message}`);
    }
  }

  async getSeriesById(url, apiKey, seriesId) {
    try {
      const response = await httpGet(`${url}/api/v3/series/${seriesId}`, {
        headers: { 'X-Api-Key': apiKey },
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

export const sonarrService = new SonarrService();
