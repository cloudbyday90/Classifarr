const axios = require('axios');

class TavilyService {
  constructor() {
    this.baseUrl = 'https://api.tavily.com';
  }

  /**
   * Test connection to Tavily API
   */
  async testConnection(apiKey) {
    try {
      const response = await axios.post(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query: 'test',
        max_results: 1
      }, {
        timeout: 5000
      });
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      let code = 'CONNECTION_ERROR';
      let message = error.response?.data?.error || error.message;
      
      if (error.code === 'ECONNREFUSED') {
        code = 'ECONNREFUSED';
        message = 'Connection refused';
      } else if (error.code === 'ETIMEDOUT') {
        code = 'ETIMEDOUT';
        message = 'Connection timed out';
      } else if (error.response?.status === 401) {
        code = 'UNAUTHORIZED';
        message = 'Invalid API key';
      } else if (error.response?.status === 403) {
        code = 'FORBIDDEN';
        message = 'API key does not have access';
      }
      
      return { success: false, error: message, code };
    }
  }

  /**
   * Search for media information
   * @param {string} query - Search query (e.g., "Squid Game IMDB parents guide")
   * @param {object} options - Search options
   */
  async search(query, options = {}) {
    const {
      apiKey,
      searchDepth = 'basic',
      maxResults = 5,
      includeDomains = ['imdb.com', 'rottentomatoes.com'],
      excludeDomains = []
    } = options;

    if (!apiKey) {
      throw new Error('Tavily API key is required');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/search`, {
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_domains: includeDomains,
        exclude_domains: excludeDomains,
        include_answer: true,
        include_raw_content: false
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unknown error occurred';
      throw new Error(`Tavily search failed: ${errorMessage}`);
    }
  }

  /**
   * Search IMDB for media details
   */
  async searchIMDB(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} site:imdb.com`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 3
    });
  }

  /**
   * Get IMDB parents guide / content advisory
   */
  async getContentAdvisory(title, year, options) {
    const query = `${title} ${year} IMDB parents guide content advisory`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 2
    });
  }

  /**
   * Search for anime-specific information
   */
  async searchAnimeInfo(title, options) {
    const query = `${title} anime MyAnimeList`;
    return this.search(query, {
      ...options,
      includeDomains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
      maxResults: 3
    });
  }

  /**
   * Get aggregated rating/review info
   */
  async getReviewInfo(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} reviews ratings`;
    return this.search(query, {
      ...options,
      includeDomains: ['rottentomatoes.com', 'metacritic.com', 'letterboxd.com'],
      maxResults: 3
    });
  }

  /**
   * Extract structured data from Tavily results for AI consumption
   */
  formatForAI(tavilyResults) {
    if (!tavilyResults || !tavilyResults.results) {
      return 'No additional information found.';
    }

    let formatted = 'Web Search Results:\n\n';
    
    for (const result of tavilyResults.results) {
      formatted += `Source: ${result.url}\n`;
      formatted += `Title: ${result.title}\n`;
      formatted += `Content: ${result.content}\n\n`;
    }

    if (tavilyResults.answer) {
      formatted += `\nSummary: ${tavilyResults.answer}\n`;
    }

    return formatted;
  }
}

module.exports = new TavilyService();
