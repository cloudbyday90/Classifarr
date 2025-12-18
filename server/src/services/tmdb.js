const axios = require('axios');
const db = require('../config/database');

class TMDBService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = null;
  }

  async getApiKey() {
    if (this.apiKey) {
      return this.apiKey;
    }
    
    // Try to load from database
    const result = await db.query('SELECT api_key FROM tmdb_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.apiKey = result.rows[0].api_key;
      return this.apiKey;
    }
    
    // Fall back to environment variable
    this.apiKey = process.env.TMDB_API_KEY;
    return this.apiKey;
  }

  async testConnection(apiKey = null) {
    try {
      const key = apiKey || await this.getApiKey();
      if (!key) {
        return { success: false, error: 'No API key provided' };
      }

      const response = await axios.get(`${this.baseUrl}/configuration`, {
        params: { api_key: key },
        timeout: 5000,
      });

      return { 
        success: true, 
        message: 'Connection successful',
        data: response.data 
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.status_message || error.message 
      };
    }
  }

  async getMovieDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}`, {
        params: {
          api_key: apiKey,
          append_to_response: 'keywords,releases,credits',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch movie details: ${error.message}`);
    }
  }

  async getTVDetails(tmdbId) {
    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}`, {
        params: {
          api_key: apiKey,
          append_to_response: 'keywords,content_ratings,credits',
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch TV details: ${error.message}`);
    }
  }

  async getKeywords(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await axios.get(`${this.baseUrl}/${endpoint}/${tmdbId}/keywords`, {
        params: {
          api_key: apiKey,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }
  }

  async getCertification(tmdbId, mediaType) {
    try {
      const apiKey = await this.getApiKey();
      if (mediaType === 'movie') {
        const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}/releases`, {
          params: {
            api_key: apiKey,
          },
        });
        const usRelease = response.data.countries.find(c => c.iso_3166_1 === 'US');
        return usRelease?.certification || 'NR';
      } else {
        const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}/content_ratings`, {
          params: {
            api_key: apiKey,
          },
        });
        const usRating = response.data.results.find(r => r.iso_3166_1 === 'US');
        return usRating?.rating || 'NR';
      }
    } catch (error) {
      console.error('Failed to fetch certification:', error.message);
      return 'NR';
    }
  }
}

module.exports = new TMDBService();
