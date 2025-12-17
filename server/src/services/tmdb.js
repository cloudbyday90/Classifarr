const axios = require('axios');

class TMDBService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = process.env.TMDB_API_KEY;
  }

  async testConnection(apiKey) {
    try {
      const key = apiKey || this.apiKey;
      const response = await axios.get(`${this.baseUrl}/configuration`, {
        params: {
          api_key: key,
        },
        timeout: 5000,
      });
      return { 
        success: true, 
        version: 3,
        baseUrl: response.data.images?.base_url || 'https://image.tmdb.org/t/p/'
      };
    } catch (error) {
      throw new Error(`Failed to connect to TMDB: ${error.message}`);
    }
  }

  async getMovieDetails(tmdbId) {
    try {
      const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}`, {
        params: {
          api_key: this.apiKey,
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
      const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}`, {
        params: {
          api_key: this.apiKey,
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
      const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
      const response = await axios.get(`${this.baseUrl}/${endpoint}/${tmdbId}/keywords`, {
        params: {
          api_key: this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch keywords: ${error.message}`);
    }
  }

  async getCertification(tmdbId, mediaType) {
    try {
      if (mediaType === 'movie') {
        const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}/releases`, {
          params: {
            api_key: this.apiKey,
          },
        });
        const usRelease = response.data.countries.find(c => c.iso_3166_1 === 'US');
        return usRelease?.certification || 'NR';
      } else {
        const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}/content_ratings`, {
          params: {
            api_key: this.apiKey,
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
