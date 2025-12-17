const axios = require('axios');
const { query } = require('../config/database');

class SonarrService {
  async getConfig(libraryId) {
    const result = await query(
      'SELECT * FROM sonarr_config WHERE library_id = $1 AND enabled = true LIMIT 1',
      [libraryId]
    );
    return result.rows[0] || null;
  }

  async addSeries(config, metadata) {
    if (!config) {
      throw new Error('Sonarr config not found');
    }

    try {
      const payload = {
        title: metadata.title,
        year: metadata.year,
        tvdbId: metadata.tvdbId || 0,
        tmdbId: metadata.tmdbId,
        qualityProfileId: config.quality_profile_id,
        rootFolderPath: config.root_folder_path,
        monitored: true,
        seasonFolder: true,
        addOptions: {
          searchForMissingEpisodes: true
        }
      };

      if (config.tag) {
        // First get tag ID
        const tagsResponse = await axios.get(`${config.url}/api/v3/tag`, {
          headers: { 'X-Api-Key': config.api_key }
        });
        const tag = tagsResponse.data.find(t => t.label === config.tag);
        if (tag) {
          payload.tags = [tag.id];
        }
      }

      const response = await axios.post(
        `${config.url}/api/v3/series`,
        payload,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return {
        success: true,
        seriesId: response.data.id,
        data: response.data
      };
    } catch (err) {
      console.error('Sonarr API error:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data || err.message
      };
    }
  }

  async updateSeries(config, seriesId, updates) {
    if (!config) {
      throw new Error('Sonarr config not found');
    }

    try {
      // First get the series
      const getResponse = await axios.get(
        `${config.url}/api/v3/series/${seriesId}`,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      const series = getResponse.data;
      const updatedSeries = { ...series, ...updates };

      const response = await axios.put(
        `${config.url}/api/v3/series/${seriesId}`,
        updatedSeries,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (err) {
      console.error('Sonarr update error:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data || err.message
      };
    }
  }

  async searchSeries(config, tmdbId) {
    if (!config) return null;

    try {
      const response = await axios.get(
        `${config.url}/api/v3/series`,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return response.data.find(s => s.tmdbId === tmdbId);
    } catch (err) {
      console.error('Sonarr search error:', err.message);
      return null;
    }
  }

  async moveSeries(oldConfig, newConfig, tmdbId) {
    try {
      // Find series in old Sonarr
      const series = await this.searchSeries(oldConfig, tmdbId);
      if (!series) {
        return { success: false, error: 'Series not found in Sonarr' };
      }

      // Update root folder path
      const updateResult = await this.updateSeries(oldConfig, series.id, {
        rootFolderPath: newConfig.root_folder_path
      });

      return updateResult;
    } catch (err) {
      console.error('Sonarr move error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = new SonarrService();
