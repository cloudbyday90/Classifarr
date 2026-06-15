/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { formatWebSearchResponseForAI } from './webSearchResultNormalizer.mjs';
import {
  TAVILY_API_BASE_URL,
  tavilyProviderClient as defaultTavilyProviderClient,
} from './tavilyProviderClient.mjs';

export class TavilyService {
  constructor({
    tavilyClient = defaultTavilyProviderClient,
  } = {}) {
    this.tavilyClient = tavilyClient;
    this.baseUrl = tavilyClient.baseUrl || TAVILY_API_BASE_URL;
  }

  async testConnection(apiKey) {
    return this.tavilyClient.testConnection(apiKey);
  }

  async checkHealth(apiKey) {
    return this.tavilyClient.checkHealth(apiKey);
  }

  async search(query, options = {}) {
    return this.tavilyClient.search(query, options);
  }

  async searchIMDB(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} site:imdb.com`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 3
    });
  }

  async getContentAdvisory(title, year, options) {
    const query = `${title} ${year} IMDB parents guide content advisory`;
    return this.search(query, {
      ...options,
      includeDomains: ['imdb.com'],
      maxResults: 2
    });
  }

  async searchAnimeInfo(title, options) {
    const query = `${title} anime MyAnimeList`;
    return this.search(query, {
      ...options,
      includeDomains: ['myanimelist.net', 'anilist.co', 'anidb.net'],
      maxResults: 3
    });
  }

  async getReviewInfo(title, year, mediaType, options) {
    const query = `${title} ${year} ${mediaType} reviews ratings`;
    return this.search(query, {
      ...options,
      includeDomains: ['rottentomatoes.com', 'metacritic.com', 'letterboxd.com'],
      maxResults: 3
    });
  }

  formatForAI(tavilyResults) {
    return formatWebSearchResponseForAI(tavilyResults, { provider: 'tavily' });
  }
}

export const tavilyService = new TavilyService();
