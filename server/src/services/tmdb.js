const axios = require('axios');

/**
 * TMDB (The Movie Database) API Service
 * Provides methods to fetch movie and TV show metadata
 */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * Get movie details from TMDB
 * @param {string|number} tmdbId - TMDB movie ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object>} Movie details
 */
async function getMovieDetails(tmdbId, apiKey) {
  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}`;
    const response = await axios.get(url, {
      params: {
        api_key: apiKey,
        append_to_response: 'credits,keywords',
      },
      timeout: 10000,
    });
    
    const data = response.data;
    
    return {
      id: data.id,
      title: data.title,
      originalTitle: data.original_title,
      overview: data.overview,
      releaseDate: data.release_date,
      year: data.release_date ? new Date(data.release_date).getFullYear() : null,
      genres: data.genres?.map(g => g.name) || [],
      runtime: data.runtime,
      voteAverage: data.vote_average,
      popularity: data.popularity,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      // TMDB movie keywords are nested under keywords.keywords
      keywords: data.keywords?.keywords?.map(k => k.name) || [],
    };
  } catch (error) {
    console.error('Failed to get movie details from TMDB:', error.message);
    throw new Error(`Failed to retrieve movie details: ${error.message}`);
  }
}

/**
 * Get TV show details from TMDB
 * @param {string|number} tmdbId - TMDB TV show ID
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Object>} TV show details
 */
async function getTVDetails(tmdbId, apiKey) {
  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}`;
    const response = await axios.get(url, {
      params: {
        api_key: apiKey,
        append_to_response: 'credits,keywords',
      },
      timeout: 10000,
    });
    
    const data = response.data;
    
    return {
      id: data.id,
      name: data.name,
      originalName: data.original_name,
      overview: data.overview,
      firstAirDate: data.first_air_date,
      year: data.first_air_date ? new Date(data.first_air_date).getFullYear() : null,
      genres: data.genres?.map(g => g.name) || [],
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      voteAverage: data.vote_average,
      popularity: data.popularity,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      // TMDB TV keywords are nested under keywords.results
      keywords: data.keywords?.results?.map(k => k.name) || [],
    };
  } catch (error) {
    console.error('Failed to get TV details from TMDB:', error.message);
    throw new Error(`Failed to retrieve TV show details: ${error.message}`);
  }
}

/**
 * Get keywords for a media item
 * @param {string|number} tmdbId - TMDB ID
 * @param {string} mediaType - Type of media ('movie' or 'tv')
 * @param {string} apiKey - TMDB API key
 * @returns {Promise<Array>} Array of keywords
 */
async function getKeywords(tmdbId, mediaType, apiKey) {
  try {
    const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
    const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}/keywords`;
    const response = await axios.get(url, {
      params: {
        api_key: apiKey,
      },
      timeout: 10000,
    });
    
    // Movie keywords are in 'keywords', TV keywords are in 'results'
    const keywordData = response.data.keywords || response.data.results || [];
    return keywordData.map(k => k.name);
  } catch (error) {
    console.error('Failed to get keywords from TMDB:', error.message);
    throw new Error(`Failed to retrieve keywords: ${error.message}`);
  }
}

module.exports = {
  getMovieDetails,
  getTVDetails,
  getKeywords,
};
