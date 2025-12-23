/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const db = require('../config/database');
const tmdbService = require('./tmdb');
const ollamaService = require('./ollama');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const discordBot = require('./discordBot');
const tavilyService = require('./tavily');
const mediaSyncService = require('./mediaSync');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');
const clarificationService = require('./clarificationService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('classification');

class ClassificationService {
  async classify(overseerrPayload) {
    try {
      // Parse payload - supports multiple formats (Overseerr, Plex gap analysis, Rule Builder)
      const { media_type, tmdbId, title, year, existingMetadata } = this.parseOverseerrPayload(overseerrPayload);

      logger.info(`Starting classification for ${media_type}: ${title} (TMDB: ${tmdbId || 'searching...'})`);

      let metadata;

      // If we have existing metadata from payload (gap analysis with local data), use it
      if (existingMetadata.overview && existingMetadata.genres && existingMetadata.genres.length > 0) {
        logger.info(`Using existing metadata for ${title}`);
        metadata = {
          tmdb_id: tmdbId || null,
          media_type: media_type,
          title: title,
          year: year,
          overview: existingMetadata.overview,
          genres: existingMetadata.genres,
          keywords: existingMetadata.keywords || [],
          certification: existingMetadata.content_rating,
          original_language: existingMetadata.original_language || 'en',
          itemId: existingMetadata.itemId,
          source_library_id: existingMetadata.source_library_id,
          source_library_name: existingMetadata.source_library_name,
        };
      } else if (tmdbId) {
        // We have TMDB ID - lookup directly
        metadata = await this.enrichWithTMDB(tmdbId, media_type);
        metadata.itemId = existingMetadata.itemId;
        metadata.source_library_id = existingMetadata.source_library_id;
        metadata.source_library_name = existingMetadata.source_library_name;
      } else if (title && title !== 'Unknown') {
        // No TMDB ID - search by title/year
        logger.info(`No TMDB ID found, searching TMDB for: ${title} (${year || 'any year'})`);

        const searchResults = await tmdbService.search(title, media_type);

        if (searchResults && searchResults.length > 0) {
          // Find best match by year if we have one
          let bestMatch = searchResults[0];
          if (year) {
            const yearMatch = searchResults.find(r => r.year === String(year));
            if (yearMatch) {
              bestMatch = yearMatch;
            }
          }

          logger.info(`Found TMDB match: ${bestMatch.title} (${bestMatch.year}) - ID: ${bestMatch.id}`);

          // Now get full details
          metadata = await this.enrichWithTMDB(bestMatch.id, media_type);
          metadata.itemId = existingMetadata.itemId;
          metadata.source_library_id = existingMetadata.source_library_id;
          metadata.source_library_name = existingMetadata.source_library_name;
        } else {
          // No TMDB match found - create basic metadata from what we have
          logger.warn(`No TMDB match found for: ${title}. Using basic metadata.`);
          metadata = {
            tmdb_id: null,
            media_type: media_type,
            title: title,
            year: year,
            overview: existingMetadata.overview || '',
            genres: existingMetadata.genres || [],
            keywords: existingMetadata.keywords || [],
            certification: existingMetadata.content_rating || 'NR',
            original_language: existingMetadata.original_language || 'en',
            itemId: existingMetadata.itemId,
            source_library_id: existingMetadata.source_library_id,
            source_library_name: existingMetadata.source_library_name,
          };
        }
      } else {
        throw new Error('No TMDB ID or title provided for classification');
      }

      // Run decision tree
      const result = await this.runDecisionTree(metadata, media_type);

      // Log to database
      const classificationId = await this.logClassification(metadata, result);

      // Check if user requires all confirmations
      const requireAllConfirmations = await clarificationService.isRequireAllConfirmationsEnabled();

      // Route to Radarr/Sonarr only if confidence is high enough AND user doesn't require all confirmations
      if (result.library && result.library.arr_type && result.confidence >= 90 && !requireAllConfirmations) {
        await this.routeToArr(metadata, result.library);
      }

      // Send Discord notification with confidence-based routing
      if (discordBot.isInitialized) {
        await discordBot.sendConfidenceBasedNotification(metadata, {
          ...result,
          classification_id: classificationId,
          library_name: result.library?.name,
        });
      }

      return {
        success: true,
        classification_id: classificationId,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        reason: result.reason,
      };
    } catch (error) {
      logger.error('Classification error', { error: error.message });
      throw error;
    }
  }

  parseOverseerrPayload(payload) {
    // Handle multiple payload formats:
    // 1. Overseerr webhook: has media.tmdbId and media.media_type
    // 2. Plex gap analysis: has title, tmdb_id (maybe), media.media_type
    // 3. Rule builder: has title, tmdb_id (maybe), media_type at root

    // Extract media type - check multiple locations
    let media_type = payload.media?.media_type || payload.media_type || 'movie';
    if (!media_type && payload.subject) {
      media_type = payload.subject.includes('Movie') ? 'movie' : 'tv';
    }

    // Extract TMDB ID - check multiple locations
    const tmdbId = payload.media?.tmdbId || payload.tmdb_id || payload.extra?.[0]?.value;

    // Extract title - check multiple locations  
    const title = payload.title || payload.subject || payload.media?.title || 'Unknown';

    // Extract year for better search matching
    const year = payload.year || payload.media?.year;

    // For gap analysis items, we might have full metadata already
    const existingMetadata = {
      overview: payload.overview,
      genres: payload.genres,
      keywords: payload.keywords,
      content_rating: payload.content_rating,
      original_language: payload.original_language,
      itemId: payload.itemId, // Internal ID for updating media_server_items
      source_library_id: payload.source_library_id, // Source Plex library ID
      source_library_name: payload.source_library_name, // Source Plex library name
    };

    return { media_type, tmdbId, title, year, existingMetadata };
  }

  async enrichWithTMDB(tmdbId, mediaType) {
    try {
      let details;
      if (mediaType === 'movie') {
        details = await tmdbService.getMovieDetails(tmdbId);
      } else {
        details = await tmdbService.getTVDetails(tmdbId);
      }

      const certification = await tmdbService.getCertification(tmdbId, mediaType);

      return {
        tmdb_id: tmdbId,
        media_type: mediaType,
        title: details.title || details.name,
        original_title: details.original_title || details.original_name,
        year: details.release_date?.substring(0, 4) || details.first_air_date?.substring(0, 4),
        overview: details.overview,
        genres: details.genres?.map(g => g.name) || [],
        keywords: details.keywords?.keywords?.map(k => k.name) || details.keywords?.results?.map(k => k.name) || [],
        certification: certification,
        rating: details.vote_average,
        popularity: details.popularity,
        original_language: details.original_language,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
      };
    } catch (error) {
      throw new Error(`Failed to enrich metadata: ${error.message}`);
    }
  }

  async getTavilyConfig() {
    const result = await db.query('SELECT * FROM tavily_config WHERE is_active = true LIMIT 1');
    return result.rows[0] || null;
  }

  async enrichWithWebSearch(metadata) {
    const tavilyConfig = await this.getTavilyConfig();
    if (!tavilyConfig || !tavilyConfig.is_active || !tavilyConfig.api_key) {
      return null;
    }

    try {
      const searchOptions = {
        apiKey: tavilyConfig.api_key,
        searchDepth: tavilyConfig.search_depth || 'basic',
        maxResults: tavilyConfig.max_results || 5,
        includeDomains: tavilyConfig.include_domains || ['imdb.com', 'rottentomatoes.com'],
        excludeDomains: tavilyConfig.exclude_domains || []
      };

      // Search IMDB for additional info
      const imdbResults = await tavilyService.searchIMDB(
        metadata.title,
        metadata.year,
        metadata.media_type,
        searchOptions
      );

      // Get content advisory if needed for classification
      const advisoryResults = await tavilyService.getContentAdvisory(
        metadata.title,
        metadata.year,
        searchOptions
      );

      // If anime is suspected, get anime-specific info
      if (this.mightBeAnime(metadata)) {
        const animeResults = await tavilyService.searchAnimeInfo(metadata.title, searchOptions);
        return {
          imdb: imdbResults,
          advisory: advisoryResults,
          anime: animeResults
        };
      }

      return {
        imdb: imdbResults,
        advisory: advisoryResults
      };
    } catch (error) {
      logger.error('Tavily search failed', { error: error.message });
      return null;
    }
  }

  /**
   * Detect holiday/Christmas content from metadata
   * Comprehensive keyword list for seasonal film detection
   */
  async detectHolidayContent(metadata, libraries) {
    // Find holiday/Christmas library (look for library with Christmas/Holiday in name)
    const holidayLibrary = libraries.find(l =>
      l.name.toLowerCase().includes('christmas') ||
      l.name.toLowerCase().includes('holiday') ||
      l.name.toLowerCase().includes('xmas')
    );

    if (!holidayLibrary) {
      return null; // No holiday library configured
    }

    // Comprehensive Christmas/Holiday keyword list
    const christmasKeywords = [
      // Core Christmas terms
      'christmas', 'xmas', 'x-mas', 'santa', 'santa claus', 'father christmas',
      'north pole', 'reindeer', 'rudolph', 'frosty', 'snowman',
      'christmas eve', 'christmas day', 'december 25', 'yuletide', 'yule',
      'noel', 'nativity', 'bethlehem', 'three wise men', 'manger',
      // Christmas characters/figures
      'scrooge', 'ebenezer', 'grinch', 'krampus', 'nutcracker', 'elf', 'elves',
      'mrs claus', 'jack frost', 'the polar express',
      // Christmas activities/items
      'christmas tree', 'christmas carol', 'christmas spirit', 'christmas miracle',
      'mistletoe', 'sleigh', 'stocking', 'chimney', 'gift wrap', 'candy cane',
      'gingerbread', 'eggnog', 'figgy pudding', 'christmas dinner', 'christmas present',
      // Other winter holidays
      'hanukkah', 'chanukah', 'menorah', 'dreidel', 'kwanzaa',
      // Holiday themes
      'holiday season', 'holiday spirit', 'winter holiday', 'festive season',
      'new year', 'new years eve', 'december holiday'
    ];

    // Check overview, title, and keywords for holiday content
    const textToSearch = [
      metadata.title || '',
      metadata.overview || '',
      ...(metadata.keywords || [])
    ].join(' ').toLowerCase();

    const matchedKeywords = christmasKeywords.filter(keyword =>
      textToSearch.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      logger.info('Holiday keywords detected', {
        title: metadata.title,
        matchedKeywords: matchedKeywords.slice(0, 5) // Log first 5 matches
      });
      return holidayLibrary;
    }

    return null;
  }

  /**
   * Check library rules to find matching library
   * Rules are checked in priority order, exceptions first
   */
  async checkLibraryRules(metadata, libraries) {
    // Get all active rules for all libraries, ordered by exception status and priority
    const rulesResult = await db.query(`
      SELECT lr.*, l.name as library_name
      FROM library_rules lr
      JOIN libraries l ON lr.library_id = l.id
      WHERE lr.is_active = true AND l.is_active = true
      ORDER BY lr.is_exception DESC, l.priority DESC, lr.priority ASC
    `);

    if (rulesResult.rows.length === 0) {
      return null;
    }

    // Prepare metadata for matching
    const itemRating = (metadata.certification || '').toUpperCase();
    const itemGenres = (metadata.genres || []).map(g => g.toLowerCase());
    const itemKeywords = (metadata.keywords || []).map(k => k.toLowerCase());
    const itemLanguage = (metadata.original_language || '').toLowerCase();
    const itemYear = metadata.year ? parseInt(metadata.year) : null;
    const itemTitle = (metadata.title || '').toLowerCase();
    const itemOverview = (metadata.overview || '').toLowerCase();

    // Check each rule
    for (const rule of rulesResult.rows) {
      const ruleValues = rule.value.split(',').map(v => v.trim().toLowerCase());
      let matches = false;

      switch (rule.rule_type) {
        case 'rating':
          if (rule.operator === 'includes') {
            matches = ruleValues.some(v => v.toUpperCase() === itemRating);
          } else if (rule.operator === 'excludes') {
            matches = !ruleValues.some(v => v.toUpperCase() === itemRating);
          }
          break;

        case 'genre':
          if (rule.operator === 'includes') {
            matches = ruleValues.some(v => itemGenres.includes(v));
          } else if (rule.operator === 'excludes') {
            matches = !ruleValues.some(v => itemGenres.includes(v));
          } else if (rule.operator === 'contains') {
            matches = ruleValues.some(v => itemGenres.some(g => g.includes(v)));
          }
          break;

        case 'keyword':
          if (rule.operator === 'includes') {
            matches = ruleValues.some(v => itemKeywords.includes(v));
          } else if (rule.operator === 'contains') {
            // Check title, overview, and keywords
            matches = ruleValues.some(v =>
              itemTitle.includes(v) || itemOverview.includes(v) || itemKeywords.some(k => k.includes(v))
            );
          }
          break;

        case 'language':
          if (rule.operator === 'equals') {
            matches = ruleValues.includes(itemLanguage);
          } else if (rule.operator === 'excludes') {
            matches = !ruleValues.includes(itemLanguage);
          }
          break;

        case 'year':
          if (itemYear) {
            const targetYear = parseInt(ruleValues[0]);
            if (rule.operator === 'equals') {
              matches = itemYear === targetYear;
            } else if (rule.operator === 'greater_than') {
              matches = itemYear > targetYear;
            } else if (rule.operator === 'less_than') {
              matches = itemYear < targetYear;
            }
          }
          break;
      }

      if (matches) {
        const library = libraries.find(l => l.id === rule.library_id);
        if (library) {
          return {
            library,
            isException: rule.is_exception,
            matchedRule: `${rule.rule_type} ${rule.operator} "${rule.value}"`,
            reason: rule.description || `Matched rule: ${rule.rule_type} ${rule.operator} "${rule.value}"`
          };
        }
      }
    }

    return null;
  }

  mightBeAnime(metadata) {
    // Check if metadata suggests anime
    const keywords = (metadata.keywords || []).map(k => k.toLowerCase());
    const genres = (metadata.genres || []).map(g => g.toLowerCase());

    return (
      keywords.includes('anime') ||
      metadata.original_language === 'ja' ||
      genres.includes('anime') ||
      keywords.some(k => ['shounen', 'shoujo', 'seinen', 'isekai', 'mecha'].includes(k))
    );
  }

  async runDecisionTree(metadata, mediaType) {
    // Get all active libraries for this media type
    const librariesResult = await db.query(
      'SELECT * FROM libraries WHERE media_type = $1 AND is_active = true ORDER BY priority DESC',
      [mediaType]
    );

    const libraries = librariesResult.rows;

    if (libraries.length === 0) {
      throw new Error(`No active libraries found for media type: ${mediaType}`);
    }

    // Step -1: If item came from a known Plex library, use that library directly (100% confidence)
    if (metadata.source_library_id) {
      const sourceLibrary = libraries.find(l => l.id === metadata.source_library_id);
      if (sourceLibrary) {
        logger.info('Using source Plex library for classification', {
          title: metadata.title,
          library: sourceLibrary.name
        });
        return {
          library: sourceLibrary,
          confidence: 100,
          method: 'source_library',
          reason: `Already in library: ${sourceLibrary.name} (from Plex)`,
          libraries: libraries,
        };
      }
    }

    // Step -0.5: Detect seasonal/holiday content from overview keywords
    const holidayLibrary = await this.detectHolidayContent(metadata, libraries);
    if (holidayLibrary) {
      logger.info('Holiday content detected from overview', {
        title: metadata.title,
        library: holidayLibrary.name
      });
      return {
        library: holidayLibrary,
        confidence: 95,
        method: 'holiday_detection',
        reason: `Detected holiday/Christmas content in overview`,
        libraries: libraries,
      };
    }

    // Step -0.25: Check library rules (user-defined rating/genre/keyword rules)
    const ruleMatch = await this.checkLibraryRules(metadata, libraries);
    if (ruleMatch) {
      logger.info('Library rule matched', {
        title: metadata.title,
        library: ruleMatch.library.name,
        rule: ruleMatch.matchedRule
      });
      return {
        library: ruleMatch.library,
        confidence: ruleMatch.isException ? 98 : 90,
        method: 'library_rule',
        reason: ruleMatch.reason,
        libraries: libraries,
      };
    }

    // Step 0: Check if media already exists in media server (100% confidence)
    const existingMedia = await mediaSyncService.findExistingMedia(metadata.tmdb_id, mediaType);
    if (existingMedia) {
      logger.info('Media already exists in library', {
        tmdbId: metadata.tmdb_id,
        library: existingMedia.library_name
      });
      return {
        library: libraries.find(l => l.id === existingMedia.library_id),
        confidence: 100,
        method: 'existing_media',
        reason: `Already exists in ${existingMedia.library_name}`,
        libraries: libraries,
      };
    }

    // Step 0.5: Run content type analysis
    const contentAnalysis = await contentTypeAnalyzer.analyze(metadata);
    if (contentAnalysis.analyzed && contentAnalysis.bestMatch) {
      logger.info('Content type detected', {
        type: contentAnalysis.bestMatch.type,
        confidence: contentAnalysis.bestMatch.confidence
      });
      // Store analysis for later use
      metadata.contentAnalysis = contentAnalysis;
    }

    // Step 1: Check exact match (previously corrected TMDB ID)
    const exactMatch = await this.checkExactMatch(metadata.tmdb_id);
    if (exactMatch) {
      return {
        library: libraries.find(l => l.id === exactMatch.library_id),
        confidence: 100,
        method: 'exact_match',
        reason: 'Previously classified and confirmed',
        libraries: libraries,
      };
    }

    // Step 2: Check learned patterns (high confidence)
    const learnedPattern = await this.checkLearnedPatterns(metadata);
    if (learnedPattern && learnedPattern.confidence >= 80) {
      return {
        library: libraries.find(l => l.id === learnedPattern.library_id),
        confidence: learnedPattern.confidence,
        method: 'learned_pattern',
        reason: 'Matched learned pattern from previous corrections',
        libraries: libraries,
      };
    }

    // Step 3: Rule-based matching (labels + custom rules)
    const legacyRuleMatch = await this.matchRules(metadata, libraries);
    if (legacyRuleMatch && legacyRuleMatch.confidence >= 80) {
      return {
        ...legacyRuleMatch,
        method: 'rule_match',
        libraries: libraries,
      };
    }

    // Step 4: AI fallback (Ollama)
    try {
      const aiMatch = await this.aiClassify(metadata, libraries);
      return {
        ...aiMatch,
        method: 'ai_fallback',
        libraries: libraries,
      };
    } catch (error) {
      logger.error('AI classification failed', { error: error.message });
      // Fallback to rule match even if confidence is low
      if (legacyRuleMatch) {
        return {
          ...legacyRuleMatch,
          method: 'rule_match',
          libraries: libraries,
        };
      }
      // Last resort: use the lowest priority library (usually a generic catch-all)
      // Don't use libraries[0] because that's the highest priority specialized library
      const fallbackLibrary = libraries[libraries.length - 1];
      return {
        library: fallbackLibrary,
        confidence: 50,
        method: 'rule_match',
        reason: `Default library - no rules matched (fell back to ${fallbackLibrary.name})`,
        libraries: libraries,
      };
    }
  }

  async checkExactMatch(tmdbId) {
    const result = await db.query(
      `SELECT library_id FROM learning_patterns 
       WHERE tmdb_id = $1 AND pattern_type = 'exact_match' 
       ORDER BY updated_at DESC LIMIT 1`,
      [tmdbId]
    );
    return result.rows[0] || null;
  }

  async checkLearnedPatterns(metadata) {
    // Check for similar patterns based on genres, keywords, etc.
    // This is a simplified version - could be enhanced with more sophisticated ML
    const result = await db.query(
      `SELECT library_id, confidence FROM learning_patterns 
       WHERE pattern_type = 'genre_pattern' AND success_rate >= 70
       ORDER BY confidence DESC, usage_count DESC LIMIT 1`
    );
    return result.rows[0] || null;
  }

  async matchRules(metadata, libraries) {
    let bestMatch = null;
    let highestScore = 0;

    for (const library of libraries) {
      let score = 0;
      let reasons = [];

      // Get library labels
      const labelsResult = await db.query(
        `SELECT ll.rule_type, lp.category, lp.name, lp.display_name, lp.tmdb_match_field, lp.tmdb_match_values
         FROM library_labels ll
         JOIN label_presets lp ON ll.label_preset_id = lp.id
         WHERE ll.library_id = $1`,
        [library.id]
      );

      const labels = labelsResult.rows;

      // Check EXCLUDE labels first (disqualifying)
      const excludeLabels = labels.filter(l => l.rule_type === 'exclude');
      for (const label of excludeLabels) {
        if (this.metadataMatchesLabel(metadata, label)) {
          score = -1000; // Disqualify
          break;
        }
      }

      if (score < 0) continue; // Skip this library

      // Check INCLUDE labels (scoring)
      const includeLabels = labels.filter(l => l.rule_type === 'include');
      for (const label of includeLabels) {
        if (this.metadataMatchesLabel(metadata, label)) {
          score += 25;
          reasons.push(`Matches ${label.category}: ${label.display_name}`);
        }
      }

      // Check custom rules
      const rulesResult = await db.query(
        'SELECT * FROM library_custom_rules WHERE library_id = $1 AND is_active = true',
        [library.id]
      );

      for (const rule of rulesResult.rows) {
        if (this.evaluateCustomRule(metadata, rule.rule_json)) {
          score += 30;
          reasons.push(`Matches custom rule: ${rule.name}`);
        }
      }

      // Calculate confidence based on score
      const confidence = Math.min(100, score);

      if (confidence > highestScore) {
        highestScore = confidence;
        bestMatch = {
          library: library,
          confidence: confidence,
          reason: reasons.join('; ') || 'Matched library criteria',
        };
      }
    }

    return bestMatch;
  }

  metadataMatchesLabel(metadata, label) {
    const { tmdb_match_field, tmdb_match_values } = label;

    // If no match field/values defined, cannot match
    if (!tmdb_match_field || !tmdb_match_values || tmdb_match_values.length === 0) {
      return false;
    }

    switch (tmdb_match_field) {
      case 'certification':
        // Check if metadata certification matches any of the values
        return tmdb_match_values.some(value =>
          metadata.certification && metadata.certification.toLowerCase() === value.toLowerCase()
        );

      case 'genres':
        // Check if any metadata genre matches any of the label values
        if (!metadata.genres || !Array.isArray(metadata.genres)) {
          return false;
        }
        return tmdb_match_values.some(value =>
          metadata.genres.some(g => g.toLowerCase() === value.toLowerCase())
        );

      case 'keywords':
        // Check if any metadata keyword matches any of the label values
        if (!metadata.keywords || !Array.isArray(metadata.keywords)) {
          return false;
        }
        const keywords = metadata.keywords.map(k => k.toLowerCase());
        return tmdb_match_values.some(value =>
          keywords.includes(value.toLowerCase())
        );

      case 'original_language':
        // Check if metadata original_language matches any of the values
        return tmdb_match_values.some(value =>
          metadata.original_language && metadata.original_language.toLowerCase() === value.toLowerCase()
        );

      default:
        return false;
    }
  }

  evaluateCustomRule(metadata, ruleJson) {
    try {
      // Handle array of conditions (AND logic)
      if (Array.isArray(ruleJson)) {
        return ruleJson.every(condition => this.evaluateSingleCondition(metadata, condition));
      }
      // Handle legacy single object
      return this.evaluateSingleCondition(metadata, ruleJson);
    } catch (error) {
      logger.error('Error evaluating custom rule', { error: error.message });
      return false;
    }
  }

  evaluateSingleCondition(metadata, condition) {
    const { field, operator, value } = condition;

    // Handle nested fields (e.g., metadata.content_analysis.type)
    let fieldValue;
    if (field === 'content_type') {
      fieldValue = metadata.contentAnalysis?.bestMatch?.type;
    } else {
      fieldValue = metadata[field];
    }

    if (!fieldValue) return false;

    switch (operator) {
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v =>
            v.toLowerCase().includes(value.toLowerCase())
          );
        }
        return String(fieldValue).toLowerCase().includes(value.toLowerCase());
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v =>
            v.toLowerCase().includes(value.toLowerCase())
          );
        }
        return !String(fieldValue).toLowerCase().includes(value.toLowerCase());
      case 'equals':
        return String(fieldValue).toLowerCase() === String(value).toLowerCase();
      case 'not_equals':
        return String(fieldValue).toLowerCase() !== String(value).toLowerCase();
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(value);
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(value);
      default:
        return false;
    }
  }

  async aiClassify(metadata, libraries) {
    // Try to get web search results if Tavily is enabled
    const webSearchResults = await this.enrichWithWebSearch(metadata);

    // Build prompt for AI with contextual clarification support
    let prompt = `You are a media classification assistant for a home media server. Your job is to determine which library a ${metadata.media_type} belongs to.

CRITICAL RULES:
1. NEVER GUESS. If you are uncertain, you MUST ask for clarification.
2. Base your decision ONLY on verifiable data, not assumptions.
3. When there are conflicting signals (e.g., multiple genres that could route differently), ask for help.

--- MEDIA INFORMATION ---
Title: ${metadata.title}
Year: ${metadata.year || 'Unknown'}
Genres: ${metadata.genres.join(', ') || 'None'}
Certification: ${metadata.certification || 'Unknown'}
Keywords: ${metadata.keywords.slice(0, 15).join(', ') || 'None'}
Original Language: ${metadata.original_language || 'Unknown'}
Overview: ${metadata.overview || 'No overview available'}
`;

    // Add content analysis if available
    if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
      prompt += `\nContent Analysis Detection: ${metadata.contentAnalysis.bestMatch.type} (${metadata.contentAnalysis.bestMatch.confidence}% confident)`;
    }

    // Add web search results if available
    if (webSearchResults) {
      prompt += `\n\n--- ADDITIONAL WEB RESEARCH ---`;

      if (webSearchResults.imdb) {
        prompt += `\n${tavilyService.formatForAI(webSearchResults.imdb)}`;
      }

      if (webSearchResults.advisory) {
        prompt += `\n\nContent Advisory: ${tavilyService.formatForAI(webSearchResults.advisory)}`;
      }

      if (webSearchResults.anime) {
        prompt += `\n\nAnime Database: ${tavilyService.formatForAI(webSearchResults.anime)}`;
      }
    }

    prompt += `\n\n--- AVAILABLE LIBRARIES ---
${libraries.map((lib, i) => `${i + 1}. "${lib.name}" (${lib.media_type})`).join('\n')}

--- YOUR RESPONSE ---
Analyze the media and respond in ONE of these two formats:

FORMAT 1 - If you are confident (can determine the correct library from the data):
CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>

Example: CONFIDENT|3|92|Japanese animation with anime keywords, clearly belongs in Anime library

FORMAT 2 - If you need clarification (conflicting signals, ambiguous data, or uncertain):
CLARIFY|<problem_summary>|<why_uncertain>|<question_to_ask>|<option1>|<option2>|<option3_optional>

Example: CLARIFY|Biographical music film with drama elements|TMDB lists Drama, Music, and Biography genres - I cannot determine the PRIMARY classification from this data|Is "${metadata.title}" primarily a biographical drama about a musician's life, or a music-focused documentary with performance footage?|Biographical Drama|Music Documentary|Neither - route manually

IMPORTANT FOR CLARIFICATION:
- The problem_summary should be SHORT (max 50 chars)
- The why_uncertain should explain WHAT DATA conflicts and WHY you can't decide
- The question should be SPECIFIC and help the user understand what choosing each option means
- Always provide 2-3 clear options (not just yes/no when possible)

Think step by step, then respond with ONLY one of the formats above.`;

    // Get Ollama config
    const configResult = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0] || { model: 'qwen3:14b', temperature: 0.30 };

    const response = await ollamaService.generate(
      prompt,
      config.model,
      parseFloat(config.temperature)
    );

    // Parse AI response - check for CONFIDENT format
    const confidentMatch = response.match(/CONFIDENT\|(\d+)\|(\d+)\|(.+)/);
    if (confidentMatch) {
      const libraryIndex = parseInt(confidentMatch[1]) - 1;
      const confidence = Math.min(95, Math.max(50, parseInt(confidentMatch[2]))); // Clamp 50-95
      const reason = confidentMatch[3].trim();

      if (libraryIndex >= 0 && libraryIndex < libraries.length) {
        return {
          library: libraries[libraryIndex],
          confidence: confidence,
          reason: `AI: ${reason}`,
          needs_clarification: false,
        };
      }
    }

    // Parse AI response - check for CLARIFY format
    const clarifyMatch = response.match(/CLARIFY\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)(?:\|([^|]+))?/);
    if (clarifyMatch) {
      const problemSummary = clarifyMatch[1].trim();
      const whyUncertain = clarifyMatch[2].trim();
      const question = clarifyMatch[3].trim();
      const options = [clarifyMatch[4].trim(), clarifyMatch[5].trim()];
      if (clarifyMatch[6]) {
        options.push(clarifyMatch[6].trim());
      }

      logger.info('AI requests clarification', {
        title: metadata.title,
        problem: problemSummary
      });

      return {
        library: libraries[0], // Tentative - will be updated after clarification
        confidence: 55, // Low confidence triggers clarification flow
        reason: `Needs clarification: ${problemSummary}`,
        needs_clarification: true,
        clarification: {
          problem_summary: problemSummary,
          why_uncertain: whyUncertain,
          question: question,
          options: options.map((opt, idx) => ({
            label: opt,
            value: opt.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
          })),
        },
      };
    }

    // Fallback if AI response is malformed - treat as needing clarification
    logger.warn('AI response malformed, treating as uncertain', { response: response.substring(0, 200) });
    return {
      library: libraries[0],
      confidence: 50,
      reason: 'AI could not determine classification - manual review needed',
      needs_clarification: true,
      clarification: {
        problem_summary: 'Unable to auto-classify',
        why_uncertain: 'The AI classification returned an unexpected format. Manual review is recommended.',
        question: `Which library should "${metadata.title}" be added to?`,
        options: libraries.slice(0, 4).map(lib => ({
          label: lib.name,
          value: `library_${lib.id}`,
          library_id: lib.id,
        })),
      },
    };
  }

  async logClassification(metadata, result) {
    const insertResult = await db.query(
      `INSERT INTO classification_history 
       (tmdb_id, media_type, title, year, library_id, confidence, method, reason, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        metadata.tmdb_id,
        metadata.media_type,
        metadata.title,
        metadata.year,
        result.library?.id,
        result.confidence,
        result.method,
        result.reason,
        JSON.stringify(metadata),
        'completed'
      ]
    );

    const classificationId = insertResult.rows[0].id;

    // Log content analysis if available
    if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
      const analysis = metadata.contentAnalysis.bestMatch;
      await contentTypeAnalyzer.analyze(metadata, classificationId);
    }

    return classificationId;
  }

  async routeToArr(metadata, library) {
    try {
      if (library.arr_type === 'radarr') {
        const radarrConfig = await db.query(
          'SELECT * FROM radarr_config WHERE id = $1 AND is_active = true',
          [library.arr_id]
        );

        if (radarrConfig.rows.length > 0) {
          const config = radarrConfig.rows[0];

          // Use JSONB settings with fallback to legacy fields
          const settings = library.radarr_settings && Object.keys(library.radarr_settings).length > 0
            ? library.radarr_settings
            : {
              root_folder_path: library.root_folder,
              quality_profile_id: library.quality_profile_id,
              monitor: true,
              search_on_add: true
            };

          const movieData = {
            title: metadata.title,
            tmdbId: metadata.tmdb_id,
            year: parseInt(metadata.year),
            qualityProfileId: settings.quality_profile_id,
            rootFolderPath: settings.root_folder_path,
            monitored: settings.monitor !== false,
            minimumAvailability: settings.minimum_availability || 'released',
            tags: settings.tags || [],
            addOptions: {
              searchForMovie: settings.search_on_add !== false,
            },
          };

          await radarrService.addMovie(config.url, config.api_key, movieData);
          logger.info(`Added movie to Radarr: ${metadata.title}`);
        }
      } else if (library.arr_type === 'sonarr') {
        const sonarrConfig = await db.query(
          'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
          [library.arr_id]
        );

        if (sonarrConfig.rows.length > 0) {
          const config = sonarrConfig.rows[0];

          // Use JSONB settings with fallback to legacy fields
          const settings = library.sonarr_settings && Object.keys(library.sonarr_settings).length > 0
            ? library.sonarr_settings
            : {
              root_folder_path: library.root_folder,
              quality_profile_id: library.quality_profile_id,
              series_type: 'standard',
              season_monitoring: 'all',
              monitor_new_items: 'all',
              season_folder: true,
              search_on_add: true
            };

          // Note: We'd need to get TVDB ID from TMDB external IDs
          // This is a simplified version
          const seriesData = {
            title: metadata.title,
            tvdbId: metadata.tmdb_id, // This would need proper mapping
            qualityProfileId: settings.quality_profile_id,
            rootFolderPath: settings.root_folder_path,
            monitored: settings.monitor !== false,
            seriesType: settings.series_type || 'standard',
            seasonFolder: settings.season_folder !== false,
            tags: settings.tags || [],
            addOptions: {
              searchForMissingEpisodes: settings.search_on_add !== false,
              monitor: settings.season_monitoring || 'all',
            },
          };

          await sonarrService.addSeries(config.url, config.api_key, seriesData);
          logger.info(`Added series to Sonarr: ${metadata.title}`);
        }
      }
    } catch (error) {
      logger.error('Failed to route to arr', { error: error.message });
      // Don't throw - classification was successful even if routing failed
    }
  }

  suggestSeriesType(metadata, appliedLabels = []) {
    // Anime detection
    if (appliedLabels.includes('anime') ||
      (metadata.original_language === 'ja' && appliedLabels.includes('animation'))) {
      return 'anime';
    }

    // Daily show detection
    const dailyLabels = ['late_night', 'talk', 'news', 'game_show', 'soap_opera'];
    if (dailyLabels.some(label => appliedLabels.includes(label))) {
      return 'daily';
    }

    return 'standard';
  }
}

module.exports = new ClassificationService();
