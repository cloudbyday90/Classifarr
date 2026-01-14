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
const { SignalCollector, SIGNAL_TYPES } = require('./signalCollector');
const confidenceCalculator = require('./confidenceCalculator');
const ragRetriever = require('./ragRetriever');
const embeddingService = require('./embeddingService');
const contextManager = require('./contextManager');
const patternReinforcementService = require('./patternReinforcementService');
const policyEngine = require('./policyEngine');
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

      // Reinforce patterns (if any were used in classification)
      if (result.signalContext && result.signalContext.patternSignals) {
        const patternSignals = result.signalContext.patternSignals;
        if (patternSignals.length > 0 && result.library) {
          // Async reinforcement - don't wait
          setImmediate(async () => {
            try {
              await patternReinforcementService.reinforceOnAccept(
                classificationId,
                patternSignals,
                result.library.id
              );
            } catch (error) {
              logger.debug('Pattern reinforcement error', { error: error.message });
            }
          });
        }
      }

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

      // Enhanced AI metrics logging for monitoring and debugging
      logger.info('Classification completed', {
        title: metadata.title,
        tmdbId: metadata.tmdb_id,
        mediaType: media_type,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        hasSourceLibrary: !!metadata.source_library_id,
        contentType: metadata.contentAnalysis?.bestMatch?.type || null
      });

      return {
        success: true,
        classification_id: classificationId,
        library: result.library?.name,
        confidence: result.confidence,
        method: result.method,
        reason: result.reason,
        // Include bestMatch for queue service to use
        bestMatch: metadata.contentAnalysis?.bestMatch
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
        searchDepth: tavilyConfig.search_depth || 'advanced',
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
   * Detect all matching event types from metadata (for rule condition evaluation)
   * Returns array of event type strings that match keywords in metadata
   */
  detectEventTypesFromMetadata(metadata) {
    const textToSearch = [
      metadata.title || '',
      metadata.overview || '',
      ...(metadata.keywords || []),
      ...(metadata.genres || [])
    ].join(' ').toLowerCase();

    const eventKeywords = {
      holiday: ['christmas', 'xmas', 'santa', 'halloween', 'thanksgiving', 'easter', 'hanukkah', 'kwanzaa', 'new years eve', 'holiday'],
      sports: ['nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'super bowl', 'world series', 'olympics', 'championship', 'playoffs'],
      ppv: ['ufc', 'mma', 'boxing', 'wwe', 'wrestling', 'wrestlemania', 'bellator', 'fight night', 'knockout'],
      concert: ['concert', 'live tour', 'music festival', 'live performance', 'symphony', 'orchestra', 'unplugged'],
      standup: ['stand-up', 'standup', 'comedy special', 'comedian', 'comedy tour', 'roast', 'improv'],
      awards: ['oscars', 'academy awards', 'emmys', 'golden globes', 'grammys', 'tony awards', 'bafta', 'red carpet']
    };

    const matchedTypes = [];
    for (const [eventType, keywords] of Object.entries(eventKeywords)) {
      if (keywords.some(kw => textToSearch.includes(kw))) {
        matchedTypes.push(eventType);
      }
    }
    return matchedTypes;
  }

  /**
   * Detect event/special content from metadata
   * Covers: holidays, sports, PPV/combat, concerts, awards shows
   * Returns matched library and event type for detailed classification
   * 
   * @deprecated since v0.37.0 - Event detection migrated to PolicyEngine presets
   * This method is kept for backward compatibility but is no longer called in the classification flow.
   * Event types are now handled via content_presets in the 'events' category.
   * See migration 046_event_detection_presets.sql
   */
  async detectEventContent(metadata, libraries) {
    logger.warn('detectEventContent is deprecated - event detection now handled by PolicyEngine presets');
    const textToSearch = [
      metadata.title || '',
      metadata.overview || '',
      ...(metadata.keywords || []),
      ...(metadata.genres || [])
    ].join(' ').toLowerCase();

    // Event type definitions with keywords and library name patterns
    const eventTypes = {
      holiday: {
        libraryPatterns: ['christmas', 'holiday', 'xmas', 'seasonal'],
        keywords: [
          // Christmas
          'christmas', 'xmas', 'x-mas', 'santa', 'santa claus', 'father christmas',
          'north pole', 'reindeer', 'rudolph', 'frosty', 'snowman',
          'christmas eve', 'christmas day', 'december 25', 'yuletide', 'yule',
          'noel', 'nativity', 'bethlehem', 'scrooge', 'grinch', 'krampus',
          'nutcracker', 'polar express', 'christmas tree', 'christmas carol',
          'mistletoe', 'candy cane', 'gingerbread', 'eggnog',
          // Other holidays
          'halloween', 'trick or treat', 'haunted', 'hanukkah', 'chanukah',
          'kwanzaa', 'thanksgiving', 'easter', 'valentines day',
          'new years eve', 'new year celebration'
        ],
        confidence: 95,
        icon: '🎄',
        reason: 'Detected holiday/seasonal content'
      },
      sports: {
        libraryPatterns: ['sports', 'sport', 'athletics', 'games'],
        keywords: [
          // Major leagues
          'nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa', 'uefa', 'premier league',
          'super bowl', 'world series', 'stanley cup', 'world cup',
          // Sports terms
          'championship', 'playoffs', 'tournament', 'Olympics', 'olympic games',
          'espn', 'sports documentary', 'football game', 'basketball game',
          'baseball game', 'hockey game', 'soccer match', 'tennis match',
          'golf tournament', 'motorsports', 'nascar', 'formula 1', 'f1',
          'indy 500', 'grand prix', 'marathon', 'world series of poker',
          // Athletes
          '30 for 30', 'sports biography'
        ],
        confidence: 92,
        icon: '🏈',
        reason: 'Detected sports content'
      },
      ppv: {
        libraryPatterns: ['ppv', 'fighting', 'combat', 'ufc', 'mma', 'boxing', 'wrestling'],
        keywords: [
          // MMA/UFC
          'ufc', 'mma', 'ultimate fighting', 'bellator', 'pride fc', 'one championship',
          'mixed martial arts', 'cage fight', 'octagon',
          // Boxing  
          'boxing', 'heavyweight', 'middleweight', 'welterweight', 'title fight',
          'championship bout', 'knockout', 'floyd mayweather', 'mike tyson',
          // Wrestling
          'wwe', 'wrestling', 'wrestlemania', 'royal rumble', 'summerslam',
          'aew', 'pro wrestling', 'smackdown', 'raw',
          // General PPV
          'pay per view', 'ppv', 'fight night', 'main event'
        ],
        confidence: 93,
        icon: '🥊',
        reason: 'Detected PPV/combat sports content'
      },
      concert: {
        libraryPatterns: ['concert', 'music', 'live music', 'performance'],
        keywords: [
          // Live music
          'concert', 'live performance', 'live tour', 'world tour', 'music festival',
          'coachella', 'lollapalooza', 'glastonbury', 'rock concert', 'pop concert',
          'symphony', 'orchestra', 'unplugged', 'acoustic session', 'mtv unplugged',
          'live album', 'concert film', 'tour documentary'
        ],
        confidence: 90,
        icon: '🎵',
        reason: 'Detected concert/live music content'
      },
      standup: {
        libraryPatterns: ['stand-up', 'standup', 'comedy special', 'comedy'],
        keywords: [
          // Stand-up comedy specials
          'stand-up', 'standup', 'comedy special', 'netflix special', 'hbo special',
          'live at the apollo', 'def comedy jam', 'comedian', 'comedy tour',
          'comedy central', 'roast', 'just for laughs', 'improv', 'one-man show',
          'one-woman show', 'comedy night', 'stand up comedy'
        ],
        confidence: 90,
        icon: '🎤',
        reason: 'Detected stand-up comedy content'
      },
      awards: {
        libraryPatterns: ['awards', 'ceremony', 'gala'],
        keywords: [
          'oscars', 'academy awards', 'emmys', 'golden globes', 'grammys',
          'tony awards', 'bafta', 'mtv awards', 'vma', 'ama', 'billboard awards',
          'peoples choice', 'critics choice', 'sag awards', 'bet awards',
          'award ceremony', 'award show', 'red carpet'
        ],
        confidence: 88,
        icon: '🏆',
        reason: 'Detected awards show content'
      }
    };

    // Check each event type for keyword matches
    for (const [eventType, config] of Object.entries(eventTypes)) {
      // Check for keyword matches in content
      const matchedKeywords = config.keywords.filter(keyword =>
        textToSearch.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length === 0) {
        continue; // No keywords matched for this event type
      }

      // Find library explicitly assigned to this event type (via dropdown)
      const assignedLibrary = libraries.find(l => l.event_detection_type === eventType);
      if (!assignedLibrary) {
        continue; // No library configured for this event type
      }

      // Check library's custom rules for exceptions
      // If library has EXCLUDE rules that match, skip this library and continue to next phase
      const rulesResult = await this.checkLibraryRulesForExceptions(metadata, assignedLibrary);
      if (rulesResult && rulesResult.isExcluded) {
        logger.info(`Event detection skipped due to exclude rule`, {
          title: metadata.title,
          eventType,
          library: assignedLibrary.name,
          excludeReason: rulesResult.reason
        });
        continue; // Skip this library, continue checking other event types
      }

      logger.info(`Event content detected: ${eventType}`, {
        title: metadata.title,
        eventType,
        matchedKeywords: matchedKeywords.slice(0, 5),
        library: assignedLibrary.name,
        confirmedByRule: rulesResult?.isConfirmed || false
      });

      return {
        library: assignedLibrary,
        eventType,
        // Boost confidence if custom rules confirm the match
        confidence: rulesResult?.isConfirmed ? 98 : config.confidence,
        icon: config.icon,
        reason: config.reason,
        matchedKeywords
      };
    }

    return null;
  }

  /**
   * Check library rules specifically for exceptions/confirmations
   * Used by event detection to validate matches
   */
  async checkLibraryRulesForExceptions(metadata, library) {
    const rulesResult = await db.query(`
      SELECT * FROM library_rules_v2 
      WHERE library_id = $1 AND is_active = true
      ORDER BY priority ASC
    `, [library.id]);

    if (rulesResult.rows.length === 0) {
      return null; // No rules defined
    }

    // Prepare metadata for matching
    const itemData = {
      rating: (metadata.certification || '').toUpperCase(),
      genre: (metadata.genres || []).map(g => g.toLowerCase()),
      keyword: (metadata.keywords || []).map(k => k.toLowerCase()),
      language: (metadata.original_language || '').toLowerCase(),
      year: metadata.year ? parseInt(metadata.year) : null,
      title: (metadata.title || '').toLowerCase(),
      overview: (metadata.overview || '').toLowerCase(),
    };

    let isConfirmed = false;
    let isExcluded = false;
    let reason = '';

    for (const rule of rulesResult.rows) {
      let conditions;
      try {
        conditions = typeof rule.conditions === 'string'
          ? JSON.parse(rule.conditions)
          : rule.conditions;
      } catch (e) {
        continue;
      }

      if (!conditions || !Array.isArray(conditions)) continue;

      // Check if all conditions match
      const allMatch = conditions.every(condition => {
        const { field, operator, value } = condition;
        const itemValue = itemData[field];
        const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

        if (itemValue === null || itemValue === undefined) return false;

        // Handle array fields
        if (Array.isArray(itemValue)) {
          switch (operator) {
            case 'includes': return ruleValues.some(v => itemValue.includes(v));
            case 'excludes': return !ruleValues.some(v => itemValue.includes(v));
            case 'contains': return ruleValues.some(v => itemValue.some(item => item.includes(v)));
            default: return false;
          }
        }

        // Handle string fields
        const strValue = String(itemValue).toLowerCase();
        switch (operator) {
          case 'equals':
          case 'is': return ruleValues.includes(strValue);
          case 'includes': return ruleValues.includes(strValue);
          case 'excludes': return !ruleValues.includes(strValue);
          case 'contains': return ruleValues.some(v => strValue.includes(v));
          case 'not_contains': return !ruleValues.some(v => strValue.includes(v));
          default: return false;
        }
      });

      if (allMatch) {
        // Check if this is an exception (exclude) rule
        // Rules with 'not_contains' or 'excludes' operators act as exceptions
        const hasExcludeOperator = conditions.some(c =>
          c.operator === 'excludes' || c.operator === 'not_contains'
        );

        if (hasExcludeOperator) {
          isExcluded = true;
          reason = rule.description || rule.name;
          break;
        } else {
          isConfirmed = true;
          reason = rule.description || rule.name;
        }
      }
    }

    return { isExcluded, isConfirmed, reason };
  }

  /**
   * Check library rules to find matching library
   * Rules are checked in priority order
   * Now uses library_rules_v2 with conditions JSON format
   */
  async checkLibraryRules(metadata, libraries) {
    // Get all active rules from the v2 table
    const rulesResult = await db.query(`
      SELECT r.*, l.name as library_name
      FROM library_rules_v2 r
      JOIN libraries l ON r.library_id = l.id
      WHERE r.is_active = true AND l.is_active = true
      ORDER BY l.priority DESC, r.priority ASC
    `);

    if (rulesResult.rows.length === 0) {
      return null;
    }

    // Prepare metadata for matching
    const itemData = {
      rating: (metadata.certification || '').toUpperCase(),
      genre: (metadata.genres || []).map(g => g.toLowerCase()),
      keyword: (metadata.keywords || []).map(k => k.toLowerCase()),
      language: (metadata.original_language || '').toLowerCase(),
      year: metadata.year ? parseInt(metadata.year) : null,
      title: (metadata.title || '').toLowerCase(),
      overview: (metadata.overview || '').toLowerCase(),
      content_type: metadata.contentAnalysis?.bestMatch?.type || null,
      // Detect event types for rule matching
      event_type: this.detectEventTypesFromMetadata(metadata),
    };

    // Check each rule
    for (const rule of rulesResult.rows) {
      // Parse conditions JSON
      let conditions;
      try {
        conditions = typeof rule.conditions === 'string'
          ? JSON.parse(rule.conditions)
          : rule.conditions;
      } catch (e) {
        logger.warn('Failed to parse rule conditions', { ruleId: rule.id, error: e.message });
        continue;
      }

      if (!conditions || !Array.isArray(conditions)) continue;

      // All conditions must match (AND logic)
      const allMatch = conditions.every(condition => {
        const { field, operator, value } = condition;
        const itemValue = itemData[field];
        const ruleValues = value.split(',').map(v => v.trim().toLowerCase());

        if (itemValue === null || itemValue === undefined) return false;

        // Handle array fields (genre, keyword)
        if (Array.isArray(itemValue)) {
          switch (operator) {
            case 'includes':
              return ruleValues.some(v => itemValue.includes(v));
            case 'excludes':
              return !ruleValues.some(v => itemValue.includes(v));
            case 'contains':
              return ruleValues.some(v => itemValue.some(item => item.includes(v)));
            default:
              return false;
          }
        }

        // Handle string fields (rating, language, title, overview, content_type)
        const strValue = String(itemValue).toLowerCase();
        switch (operator) {
          case 'equals':
          case 'is':
            return ruleValues.includes(strValue);
          case 'includes':
            return ruleValues.includes(strValue);
          case 'excludes':
            return !ruleValues.includes(strValue);
          case 'contains':
            return ruleValues.some(v => strValue.includes(v));
          case 'not_contains':
            return !ruleValues.some(v => strValue.includes(v));
          case 'greater_than':
            return parseFloat(itemValue) > parseFloat(ruleValues[0]);
          case 'less_than':
            return parseFloat(itemValue) < parseFloat(ruleValues[0]);
          case 'between':
            // value format: "1990,1999" or value + value2
            const yearVal = parseFloat(itemValue);
            const [minYear, maxYear] = ruleValues[0].includes(',')
              ? ruleValues[0].split(',').map(v => parseFloat(v.trim()))
              : [parseFloat(ruleValues[0]), parseFloat(ruleValues[1] || ruleValues[0])];
            return yearVal >= minYear && yearVal <= maxYear;
          default:
            return false;
        }
      });

      if (allMatch) {
        const library = libraries.find(l => l.id === rule.library_id);
        if (library) {
          const conditionsSummary = conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ');
          return {
            library,
            isException: false,
            matchedRule: conditionsSummary,
            reason: rule.description || `Matched rule: ${rule.name}`
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

    // Step -0.75: LEARNED CORRECTIONS (highest priority - user corrections are "truth")
    // This checks if a user previously corrected this exact tmdb_id
    const learnedCorrection = await this.checkLearnedCorrections(metadata.tmdb_id, metadata.media_type);
    if (learnedCorrection) {
      const correctedLibrary = libraries.find(l => l.id === learnedCorrection.corrected_library_id);
      if (correctedLibrary) {
        logger.info('Matched learned correction from user', {
          title: metadata.title,
          library: correctedLibrary.name,
          correctedAt: learnedCorrection.created_at
        });
        return {
          library: correctedLibrary,
          confidence: 100,
          method: 'manual_correction',
          reason: `Previously corrected by user: ${learnedCorrection.corrected_by || 'user'}`,
          libraries: libraries,
        };
      }
    }

    // NOTE: Legacy event detection (Step -0.5) and library rules (Step -0.25) removed in v0.37.8c.
    // These are now handled by the PolicyEngine via content presets and policy evaluation.

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

    // NOTE: Legacy rule-based matching (Step 3) removed in v0.37.8c.
    // PolicyEngine now handles all rule-based classification via content presets.

    // Step 3: Policy Engine evaluation (v0.37.0)
    // Modern policy-based classification with comprehensive signal scoring
    try {
      logger.info('Evaluating with PolicyEngine', { title: metadata.title });
      const policyResult = await policyEngine.evaluateItem(metadata);

      if (policyResult.action === 'auto_classify' && policyResult.library) {
        // HIGH CONFIDENCE (≥85%) - Skip AI entirely, trust PolicyEngine
        logger.info('PolicyEngine auto-classified (AI skipped)', {
          title: metadata.title,
          library: policyResult.library.library_name,
          confidence: policyResult.confidence
        });
        const matchedLibrary = libraries.find(l => l.id === policyResult.library.library_id);
        if (!matchedLibrary) {
          logger.error('PolicyEngine returned library that was not found in libraries list', {
            policyLibraryId: policyResult.library.library_id,
          });
          throw new Error('PolicyEngine selected unknown library');
        }
        return {
          library: matchedLibrary,
          confidence: policyResult.confidence,
          method: 'policy_auto',
          reason: `Policy: ${policyResult.library.policy_name}`,
          libraries: libraries,
          policyResult: policyResult, // Include for logging/debugging
        };
      } else if (policyResult.action === 'prompt_confirm' && policyResult.library) {
        // MEDIUM CONFIDENCE (60-84%) - Skip AI, prompt user with PolicyEngine context
        logger.info('PolicyEngine suggests confirmation (AI skipped)', {
          title: metadata.title,
          library: policyResult.library.library_name,
          confidence: policyResult.confidence
        });
        const matchedLibrary = libraries.find(l => l.id === policyResult.library.library_id);

        // Build clarification from policy breakdown
        const policyQuestion = {
          problem_summary: `Confirm: ${policyResult.library.policy_name}`,
          why_uncertain: `Confidence ${policyResult.confidence}% - below auto-classify threshold`,
          question: `Should "${metadata.title}" go to ${matchedLibrary?.name}?`,
          options: [
            { label: `Yes, ${matchedLibrary?.name}`, value: 'confirm', library_id: matchedLibrary?.id },
            ...policyResult.ranked.slice(1, 3).map(r => ({
              label: r.library_name,
              value: `alt_${r.library_id}`,
              library_id: r.library_id
            }))
          ],
          signal_breakdown: policyResult.breakdown,
          calculated_confidence: policyResult.confidence,
        };

        return {
          library: matchedLibrary,
          confidence: policyResult.confidence,
          method: 'policy_prompt',
          reason: `Policy suggests: ${policyResult.library.policy_name}`,
          needs_clarification: true,
          clarification: policyQuestion,
          pending_reason: policyQuestion.problem_summary,
          policy_question: policyQuestion,
          libraries: libraries,
          policyResult: policyResult,
        };
      } else if (policyResult.action === 'prompt_select' && policyResult.ranked.length > 0) {
        // LOW CONFIDENCE (<60%) - Continue to AI for help
        logger.info('PolicyEngine needs AI assistance', {
          title: metadata.title,
          topLibrary: policyResult.ranked[0]?.library_name,
          confidence: policyResult.confidence
        });
        metadata.policyResult = policyResult;
        // Falls through to legacy signal collection and AI
      }
    } catch (policyError) {
      logger.warn('PolicyEngine evaluation failed, falling back to legacy signals', {
        error: policyError.message,
        title: metadata.title
      });
    }

    // Step 4: Collect signals and calculate confidence for AI verification
    // v0.33 Signal Aggregation Model (Legacy fallback)
    const signalCollector = new SignalCollector();

    // Collect ALL signals via the full pipeline (v0.38.2-alpha fix)
    const detectors = {
      checkLearnedCorrections: this.checkLearnedCorrections.bind(this),
      checkLibraryRules: this.checkLibraryRules.bind(this),
      findExistingMedia: mediaSyncService.findExistingMedia.bind(mediaSyncService),
      analyzeContent: contentTypeAnalyzer.analyze.bind(contentTypeAnalyzer),
      checkExactMatch: this.checkExactMatch.bind(this),
      checkLearnedPatterns: this.checkLearnedPatterns.bind(this),
      matchRules: this.matchRules.bind(this),
    };

    await signalCollector.collectAll(metadata, libraries, detectors);

    // Step 4.5: RAG-based semantic similarity (v0.34)
    // Note: RAG/semantic search is handled here as a separate step (not via collectAll),
    // and we keep this for backward compatibility and to generate ragContext for AI
    let ragContext = null;
    try {
      const similarItems = await ragRetriever.semanticSearch(metadata, 5);
      if (similarItems && similarItems.length > 0) {
        const suggestedLibrary = ragRetriever.getSuggestedLibrary(similarItems);
        const dynamicWeight = ragRetriever.calculateDynamicWeight(similarItems);

        if (suggestedLibrary) {
          const ragLibrary = libraries.find(l => l.id === suggestedLibrary.libraryId);
          if (ragLibrary) {
            // Only add if not already collected (collectAll may have added it)
            if (!signalCollector.hasSignal(SIGNAL_TYPES.SEMANTIC_SIMILARITY)) {
              signalCollector.addSignal(
                SIGNAL_TYPES.SEMANTIC_SIMILARITY,
                {
                  similarItems: similarItems.slice(0, 3),
                  avgSimilarity: suggestedLibrary.avgSimilarity,
                  voteCount: suggestedLibrary.voteCount
                },
                dynamicWeight,
                ragLibrary
              );
            }
            ragContext = ragRetriever.formatForAIContext(similarItems);
            logger.info('RAG signal added', {
              title: metadata.title,
              library: ragLibrary.name,
              weight: dynamicWeight,
              matches: similarItems.length
            });
          }
        }
      }
    } catch (ragError) {
      logger.debug('RAG search failed, continuing without', { error: ragError.message });
    }

    // Load weights and calculate confidence
    await confidenceCalculator.loadWeights();
    const confidenceResult = confidenceCalculator.calculate(signalCollector.getSignals());

    // Generate AI context
    const aiContext = confidenceCalculator.toAIContext(confidenceResult);

    // Create signal context for AI verification
    const signalContext = {
      ...confidenceResult,
      aiContext,
      ragContext,  // RAG similar items context for AI
      signals: signalCollector.getSignals(),
      patternSignals: signalCollector.getPatternSignals(),  // For pattern reinforcement
    };

    // Step 5: AI verification (receives pre-calculated confidence)
    try {
      const aiMatch = await this.aiClassify(metadata, libraries, signalContext);
      return {
        ...aiMatch,
        method: aiMatch.verified_by_ai ? 'ai_verified' : 'ai_analysis',
        libraries: libraries,
        signalContext: signalContext, // Include for logging
      };
    } catch (error) {
      logger.error('AI classification failed', { error: error.message });
      // Fallback to calculated result if AI fails
      if (confidenceResult.suggestedLibrary && confidenceResult.confidence >= 50) {
        return {
          library: confidenceResult.suggestedLibrary,
          confidence: confidenceResult.confidence,
          method: 'signal_calculation',
          reason: `Calculated from signals (AI unavailable)`,
          libraries: libraries,
        };
      }
      // Last resort: use the lowest priority library
      const fallbackLibrary = libraries[libraries.length - 1];
      return {
        library: fallbackLibrary,
        confidence: 50,
        method: 'fallback',
        reason: `Default library - AI unavailable (fell back to ${fallbackLibrary.name})`,
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

  /**
   * Check for learned corrections from user feedback
   * This has HIGHEST PRIORITY - user corrections are "truth"
   * Returns the correction if this exact TMDB ID was previously corrected
   */
  async checkLearnedCorrections(tmdbId, mediaType) {
    if (!tmdbId) return null;

    try {
      const result = await db.query(
        `SELECT corrected_library_id, corrected_by, title, created_at, user_note
         FROM learned_corrections 
         WHERE tmdb_id = $1 AND media_type = $2
         ORDER BY created_at DESC LIMIT 1`,
        [tmdbId, mediaType]
      );

      if (result.rows.length > 0) {
        logger.info('Found learned correction', {
          tmdbId,
          mediaType,
          correctedLibraryId: result.rows[0].corrected_library_id
        });
      }

      return result.rows[0] || null;
    } catch (error) {
      // Table might not exist yet in older installations
      logger.warn('Failed to check learned corrections', { error: error.message });
      return null;
    }
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
      case 'between':
        // value format: "1990,1999"
        const yearVal = parseFloat(fieldValue);
        const [minYear, maxYear] = value.split(',').map(v => parseFloat(v.trim()));
        return yearVal >= minYear && yearVal <= maxYear;
      default:
        return false;
    }
  }

  async aiClassify(metadata, libraries, signalContext = null) {
    // Try to get web search results if Tavily is enabled
    const webSearchResults = await this.enrichWithWebSearch(metadata);

    // Helper function to find a sensible default library
    const getDefaultLibrary = (libraries, mediaType) => {
      // Look for a general-purpose library matching the media type
      const generalNames = mediaType === 'movie' 
        ? ['movies', 'films', 'general movies']
        : ['tv shows', 'tv series', 'series', 'television'];
      
      const generalLib = libraries.find(l => 
        generalNames.some(name => l.name.toLowerCase().includes(name))
      );
      
      // Fall back to lowest priority library (most general) instead of highest
      return generalLib || libraries[libraries.length - 1];
    };

    // Build prompt for AI - VERIFICATION ROLE
    // AI receives pre-calculated confidence and must verify or request clarification
    let prompt = `You are a media classification VERIFIER for a home media server. Your role is to VERIFY a pre-calculated classification decision.

CRITICAL RULES:
1. You CANNOT override the calculated confidence score.
2. Your job is to VERIFY the suggested library makes sense, OR request clarification if there are conflicts.
3. If the calculated confidence is high and signals align, CONFIRM the decision.
4. If signals conflict or you see a potential error, REQUEST CLARIFICATION.

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

    // Add signal context if provided (v0.33 verification mode)
    if (signalContext) {
      prompt += `\n\n--- SIGNAL ANALYSIS (pre-calculated) ---
${signalContext.aiContext}

SUGGESTED LIBRARY: "${signalContext.suggestedLibrary?.name || 'Unknown'}"
CALCULATED CONFIDENCE: ${signalContext.confidence}%
${signalContext.hasConflict ? '⚠️ CONFLICT DETECTED - Multiple libraries have similar scores' : ''}
`;
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
${signalContext ? `
VERIFICATION MODE: The system has pre-calculated confidence of ${signalContext.confidence}% for library "${signalContext.suggestedLibrary?.name}".

Respond in ONE of these two formats:

FORMAT 1 - CONFIRM the suggested library (if signals align and decision makes sense):
CONFIRM|<library_number>|<brief_verification_reason>

Example: CONFIRM|2|Signals align correctly - Action movie with mainstream studio and PG-13 rating confirms Movies library

FORMAT 2 - REQUEST CLARIFICATION (if signals conflict or you see a potential error):
CLARIFY|<problem_summary>|<why_uncertain>|<question_to_ask>|<option1>|<option2>|<option3_optional>

Example: CLARIFY|Genre ambiguity|Content has both Documentary and Drama genres|Is this primarily a documentary or a drama film?|Documentaries|Movies|Review manually
` : `
Analyze the media and respond in ONE of these two formats:

FORMAT 1 - If you are confident (can determine the correct library from the data):
CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>

Example: CONFIDENT|2|88|Action movie with mainstream studio and PG-13 rating, clearly belongs in Movies library

FORMAT 2 - If you need clarification (conflicting signals, ambiguous data, or uncertain):
CLARIFY|<problem_summary>|<why_uncertain>|<question_to_ask>|<option1>|<option2>|<option3_optional>

Example: CLARIFY|Genre ambiguity|Content has both Documentary and Drama genres|Is this primarily a documentary or a drama film?|Documentaries|Movies|Neither
`}
IMPORTANT FOR CLARIFICATION:
- The problem_summary should be SHORT (max 50 chars)
- The why_uncertain should explain WHAT DATA conflicts and WHY you can't decide
- The question should be SPECIFIC and help the user understand what choosing each option means
- Always provide 2-3 clear options (not just yes/no when possible)

Think step by step, then respond with ONLY one of the formats above.`;

    // Get Ollama config
    const configResult = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0] || { model: 'qwen3:14b', temperature: 0.30 };

    // Track generation status for UI
    const itemTitle = metadata.title || 'Unknown';
    ollamaService.setGenerationStatus(true, config.model, itemTitle);

    let response;
    try {
      // Use streaming to monitor progress
      let lastLogTime = Date.now();
      response = await ollamaService.generateWithProgress(
        prompt,
        config.model,
        parseFloat(config.temperature),
        (tokenCount, isComplete) => {
          // Update token count for UI
          ollamaService.updateTokenCount(tokenCount);

          // Log progress every 2 seconds or on completion
          const now = Date.now();
          if (isComplete || now - lastLogTime > 2000) {
            logger.debug('Ollama generation progress', {
              tokens: tokenCount,
              complete: isComplete,
              model: config.model
            });
            lastLogTime = now;
          }
        }
      );
    } finally {
      // Clear generation status
      ollamaService.setGenerationStatus(false);
    }

    // Parse AI response - check for CONFIRM format (verification mode)
    const confirmMatch = response.match(/CONFIRM\|(\d+)\|(.+)/);
    if (confirmMatch && signalContext) {
      const libraryIndex = parseInt(confirmMatch[1]) - 1;
      const reason = confirmMatch[2].trim();

      if (libraryIndex >= 0 && libraryIndex < libraries.length) {
        logger.info('AI confirmed classification', {
          title: metadata.title,
          library: libraries[libraryIndex].name,
          originalConfidence: signalContext.confidence
        });
        return {
          library: libraries[libraryIndex],
          confidence: signalContext.confidence, // Use the pre-calculated confidence
          reason: `AI verified: ${reason}`,
          needs_clarification: false,
          verified_by_ai: true,
        };
      }
    }

    // Parse AI response - check for CONFIDENT format (legacy/fallback mode)
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
      const optionTexts = [clarifyMatch[4].trim(), clarifyMatch[5].trim()];
      if (clarifyMatch[6]) {
        optionTexts.push(clarifyMatch[6].trim());
      }

      // Try to match options to actual libraries
      const options = optionTexts.map((opt, idx) => {
        // Find library that matches this option text
        const matchedLibrary = libraries.find(lib =>
          opt.toLowerCase().includes(lib.name.toLowerCase()) ||
          lib.name.toLowerCase().includes(opt.toLowerCase().replace(/\s*(library|content|media)\s*/gi, ''))
        );

        return {
          label: opt,
          value: opt.toLowerCase().replace(/\s+/g, '_').substring(0, 30),
          library_id: matchedLibrary?.id || null,
          library_name: matchedLibrary?.name || null,
        };
      });

      logger.info('AI requests clarification (policy question)', {
        title: metadata.title,
        problem: problemSummary,
        options: options.map(o => o.label),
        hasSignalContext: !!signalContext
      });

      // Build policy question object for pending queue storage
      const policyQuestion = {
        problem_summary: problemSummary,
        why_uncertain: whyUncertain,
        question: question,
        options: options,
        generated_at: new Date().toISOString(),
        signal_breakdown: signalContext?.breakdown || [],
        calculated_confidence: signalContext?.confidence || null,
      };

      return {
        library: signalContext?.suggestedLibrary || getDefaultLibrary(libraries, metadata.media_type),
        confidence: signalContext?.confidence || 55, // Use calculated confidence or low default
        reason: `Needs clarification: ${problemSummary}`,
        needs_clarification: true,
        clarification: policyQuestion, // Enhanced policy question object
        pending_reason: problemSummary,
        policy_question: policyQuestion, // For database storage
        libraries: libraries, // Include libraries array for Discord dropdown
      };
    }

    // Fallback if AI response is malformed - treat as needing clarification
    logger.warn('AI response malformed, treating as uncertain', { response: response.substring(0, 200) });
    return {
      library: getDefaultLibrary(libraries, metadata.media_type),
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
      libraries: libraries, // Include libraries array for Discord dropdown
    };
  }

  async logClassification(metadata, result) {
    // Extract collection_id from metadata if available
    const collectionId = metadata.collectionId || null;
    const signalsJson = result.signals ? JSON.stringify(result.signals) :
      result.signalContext?.signals ? JSON.stringify(result.signalContext.signals) : null;

    // For pending items (needs clarification)
    const pendingReason = result.pending_reason || (result.needs_clarification ? result.reason : null);
    const policyQuestion = result.policy_question ? JSON.stringify(result.policy_question) : null;
    const status = result.needs_clarification ? 'awaiting_decision' : 'completed';

    // Only set library when classification is complete
    // When awaiting_decision, library_id and library_name should be NULL to prevent premature assignment
    const isAwaitingDecision = status === 'awaiting_decision';
    const libraryId = isAwaitingDecision ? null : (result.library?.id || null);
    const libraryName = isAwaitingDecision ? null : (result.library?.name || null);

    const insertResult = await db.query(
      `INSERT INTO classification_history 
       (tmdb_id, media_type, title, year, library_id, library_name, confidence, method, reason, metadata, status, collection_id, signals_json, pending_reason, policy_question)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        metadata.tmdb_id,
        metadata.media_type,
        metadata.title,
        metadata.year,
        libraryId,
        libraryName,
        result.confidence,
        result.method,
        result.reason,
        JSON.stringify(metadata),
        status,
        collectionId,
        signalsJson,
        pendingReason,
        policyQuestion
      ]
    );

    const classificationId = insertResult.rows[0].id;

    // Log policy question for pending items
    if (result.needs_clarification) {
      logger.info('Classification pending - awaiting clarification', {
        id: classificationId,
        title: metadata.title,
        reason: pendingReason
      });
    }

    // Log content analysis if available
    if (metadata.contentAnalysis && metadata.contentAnalysis.bestMatch) {
      const analysis = metadata.contentAnalysis.bestMatch;
      await contentTypeAnalyzer.analyze(metadata, classificationId);
    }

    // Generate embedding for RAG (async, don't wait)
    if (status === 'completed' && result.library) {
      setImmediate(async () => {
        try {
          await embeddingService.generateAndStore(classificationId, {
            ...metadata,
            library_name: libraryName
          });
        } catch (embedError) {
          logger.debug('Embedding generation deferred', { id: classificationId });
        }
      });
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
