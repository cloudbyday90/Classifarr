const axios = require('axios');
const { query } = require('../config/database');

class RadarrService {
  async getConfig(libraryId) {
    const result = await query(
      'SELECT * FROM radarr_config WHERE library_id = $1 AND enabled = true LIMIT 1',
      [libraryId]
    );
    return result.rows[0] || null;
  }

  async addMovie(config, metadata) {
    if (!config) {
      throw new Error('Radarr config not found');
    }

    try {
      const payload = {
        title: metadata.title,
        year: metadata.year,
        tmdbId: metadata.tmdbId,
        qualityProfileId: config.quality_profile_id,
        rootFolderPath: config.root_folder_path,
        monitored: true,
        addOptions: {
          searchForMovie: true
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
        `${config.url}/api/v3/movie`,
        payload,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return {
        success: true,
        movieId: response.data.id,
        data: response.data
      };
    } catch (err) {
      console.error('Radarr API error:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data || err.message
      };
    }
  }

  async updateMovie(config, movieId, updates) {
    if (!config) {
      throw new Error('Radarr config not found');
    }

    try {
      // First get the movie
      const getResponse = await axios.get(
        `${config.url}/api/v3/movie/${movieId}`,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      const movie = getResponse.data;
      const updatedMovie = { ...movie, ...updates };

      const response = await axios.put(
        `${config.url}/api/v3/movie/${movieId}`,
        updatedMovie,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (err) {
      console.error('Radarr update error:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data || err.message
      };
    }
  }

  async searchMovie(config, tmdbId) {
    if (!config) return null;

    try {
      const response = await axios.get(
        `${config.url}/api/v3/movie`,
        {
          headers: { 'X-Api-Key': config.api_key }
        }
      );

      return response.data.find(m => m.tmdbId === tmdbId);
    } catch (err) {
      console.error('Radarr search error:', err.message);
      return null;
    }
  }

  async moveMovie(oldConfig, newConfig, tmdbId) {
    try {
      // Find movie in old Radarr
      const movie = await this.searchMovie(oldConfig, tmdbId);
      if (!movie) {
        return { success: false, error: 'Movie not found in Radarr' };
      }

      // Update root folder path
      const updateResult = await this.updateMovie(oldConfig, movie.id, {
        rootFolderPath: newConfig.root_folder_path
      });

      return updateResult;
    } catch (err) {
      console.error('Radarr move error:', err.message);
      return {
        success: false,
        error: err.message
      };
    }
  }
}

module.exports = new RadarrService();
