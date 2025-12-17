const axios = require('axios');
const { query } = require('../config/database');

class TMDBService {
  constructor() {
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.apiKey = null;
  }

  async initialize() {
    const result = await query('SELECT api_key FROM tmdb_config WHERE enabled = true LIMIT 1');
    if (result.rows.length > 0) {
      this.apiKey = result.rows[0].api_key;
    }
    if (!this.apiKey) {
      this.apiKey = process.env.TMDB_API_KEY;
    }
  }

  async getMovieDetails(tmdbId) {
    if (!this.apiKey) await this.initialize();
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/movie/${tmdbId}`, {
        params: {
          api_key: this.apiKey,
          append_to_response: 'credits,keywords,release_dates,content_ratings'
        }
      });
      return this.formatMovieMetadata(response.data);
    } catch (err) {
      console.error('TMDB API error:', err.message);
      throw err;
    }
  }

  async getTVDetails(tmdbId) {
    if (!this.apiKey) await this.initialize();
    if (!this.apiKey) {
      throw new Error('TMDB API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/tv/${tmdbId}`, {
        params: {
          api_key: this.apiKey,
          append_to_response: 'credits,keywords,content_ratings'
        }
      });
      return this.formatTVMetadata(response.data);
    } catch (err) {
      console.error('TMDB API error:', err.message);
      throw err;
    }
  }

  formatMovieMetadata(data) {
    const usRelease = data.release_dates?.results?.find(r => r.iso_3166_1 === 'US');
    const certification = usRelease?.release_dates?.[0]?.certification || 'NR';

    return {
      tmdbId: data.id,
      title: data.title,
      originalTitle: data.original_title,
      year: data.release_date ? new Date(data.release_date).getFullYear() : null,
      releaseDate: data.release_date,
      overview: data.overview,
      genres: data.genres?.map(g => g.name) || [],
      rating: certification,
      runtime: data.runtime,
      language: data.original_language,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      voteAverage: data.vote_average,
      popularity: data.popularity,
      keywords: data.keywords?.keywords?.map(k => k.name) || [],
      director: data.credits?.crew?.find(c => c.job === 'Director')?.name || null,
      cast: data.credits?.cast?.slice(0, 10).map(c => c.name) || [],
      productionCompanies: data.production_companies?.map(c => c.name) || [],
      budget: data.budget,
      revenue: data.revenue
    };
  }

  formatTVMetadata(data) {
    const usRating = data.content_ratings?.results?.find(r => r.iso_3166_1 === 'US');
    const certification = usRating?.rating || 'NR';

    return {
      tmdbId: data.id,
      title: data.name,
      originalTitle: data.original_name,
      year: data.first_air_date ? new Date(data.first_air_date).getFullYear() : null,
      firstAirDate: data.first_air_date,
      overview: data.overview,
      genres: data.genres?.map(g => g.name) || [],
      rating: certification,
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      language: data.original_language,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      voteAverage: data.vote_average,
      popularity: data.popularity,
      keywords: data.keywords?.results?.map(k => k.name) || [],
      creator: data.created_by?.[0]?.name || null,
      cast: data.credits?.cast?.slice(0, 10).map(c => c.name) || [],
      networks: data.networks?.map(n => n.name) || [],
      type: data.type,
      status: data.status
    };
  }

  getPosterUrl(posterPath, size = 'w500') {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  }
}

module.exports = new TMDBService();
