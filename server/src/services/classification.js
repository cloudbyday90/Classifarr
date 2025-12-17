const db = require('../config/database');
const tmdbService = require('./tmdb');
const ollamaService = require('./ollama');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const discordBot = require('./discordBot');
const tavilyService = require('./tavily');

class ClassificationService {
  async classify(overseerrPayload) {
    try {
      // Parse Overseerr payload
      const { media_type, tmdbId, subject } = this.parseOverseerrPayload(overseerrPayload);
      
      console.log(`Starting classification for ${media_type}: ${subject} (TMDB: ${tmdbId})`);

      // Enrich with TMDB metadata
      const metadata = await this.enrichWithTMDB(tmdbId, media_type);
      
      // Run decision tree
      const result = await this.runDecisionTree(metadata, media_type);

      // Log to database
      const classificationId = await this.logClassification(metadata, result);

      // Route to Radarr/Sonarr
      if (result.library && result.library.arr_type) {
        await this.routeToArr(metadata, result.library);
      }

      // Send Discord notification
      if (discordBot.isInitialized) {
        await discordBot.sendClassificationNotification(metadata, {
          ...result,
          classification_id: classificationId,
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
      console.error('Classification error:', error);
      throw error;
    }
  }

  parseOverseerrPayload(payload) {
    // Overseerr sends different payloads based on media type
    const media_type = payload.media?.media_type || (payload.subject.includes('Movie') ? 'movie' : 'tv');
    const tmdbId = payload.media?.tmdbId || payload.extra?.[0]?.value;
    const subject = payload.subject || 'Unknown';

    return { media_type, tmdbId, subject };
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
    const result = await db.query('SELECT * FROM tavily_config LIMIT 1');
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
      console.error('Tavily search failed:', error);
      return null;
    }
  }

  mightBeAnime(metadata) {
    // Check if metadata suggests anime
    const keywords = metadata.keywords.map(k => k.toLowerCase());
    const genres = metadata.genres.map(g => g.toLowerCase());
    
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
    const ruleMatch = await this.matchRules(metadata, libraries);
    if (ruleMatch && ruleMatch.confidence >= 80) {
      return {
        ...ruleMatch,
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
      console.error('AI classification failed:', error);
      // Fallback to rule match even if confidence is low
      if (ruleMatch) {
        return {
          ...ruleMatch,
          method: 'rule_match',
          libraries: libraries,
        };
      }
      // Last resort: use first library
      return {
        library: libraries[0],
        confidence: 50,
        method: 'rule_match',
        reason: 'Default library (no rules matched)',
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
        `SELECT ll.rule_type, lp.category, lp.label 
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
          reasons.push(`Matches ${label.category}: ${label.label}`);
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
    const { category, label: labelValue } = label;

    switch (category) {
      case 'rating':
        return metadata.certification === labelValue;
      case 'genre':
        return metadata.genres.some(g => 
          g.toLowerCase().includes(labelValue.toLowerCase())
        );
      case 'content_type':
        // Enhanced content type detection
        const keywords = metadata.keywords.map(k => k.toLowerCase());
        const overview = metadata.overview?.toLowerCase() || '';
        
        switch (labelValue.toLowerCase()) {
          case 'animated':
            return metadata.genres.some(g => g.toLowerCase().includes('animation'));
          case 'anime':
            return keywords.includes('anime') || metadata.original_language === 'ja';
          case 'documentary':
            return metadata.genres.some(g => g.toLowerCase().includes('documentary'));
          case 'kids':
          case 'family':
            return metadata.genres.some(g => g.toLowerCase().includes('family'));
          default:
            return keywords.includes(labelValue.toLowerCase()) || 
                   overview.includes(labelValue.toLowerCase());
        }
      default:
        return false;
    }
  }

  evaluateCustomRule(metadata, ruleJson) {
    try {
      // Custom rules are stored as JSON with conditions
      // Example: { "field": "genres", "operator": "contains", "value": "Action" }
      const { field, operator, value } = ruleJson;
      const fieldValue = metadata[field];

      if (!fieldValue) return false;

      switch (operator) {
        case 'contains':
          if (Array.isArray(fieldValue)) {
            return fieldValue.some(v => 
              v.toLowerCase().includes(value.toLowerCase())
            );
          }
          return String(fieldValue).toLowerCase().includes(value.toLowerCase());
        case 'equals':
          return fieldValue === value;
        case 'greater_than':
          return parseFloat(fieldValue) > parseFloat(value);
        case 'less_than':
          return parseFloat(fieldValue) < parseFloat(value);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error evaluating custom rule:', error);
      return false;
    }
  }

  async aiClassify(metadata, libraries) {
    // Try to get web search results if Tavily is enabled
    const webSearchResults = await this.enrichWithWebSearch(metadata);

    // Build prompt for AI
    let prompt = `You are a media classification assistant. Analyze the following ${metadata.media_type} and determine which library it should be added to.

Media Information:
- Title: ${metadata.title}
- Year: ${metadata.year}
- Genres: ${metadata.genres.join(', ')}
- Certification: ${metadata.certification}
- Keywords: ${metadata.keywords.slice(0, 10).join(', ')}
- Overview: ${metadata.overview}
`;

    // Add web search results if available
    if (webSearchResults) {
      prompt += `\n--- Additional Web Search Information ---\n`;
      
      if (webSearchResults.imdb) {
        prompt += tavilyService.formatForAI(webSearchResults.imdb);
      }
      
      if (webSearchResults.advisory) {
        prompt += `\n--- Content Advisory ---\n`;
        prompt += tavilyService.formatForAI(webSearchResults.advisory);
      }
      
      if (webSearchResults.anime) {
        prompt += `\n--- Anime Database Info ---\n`;
        prompt += tavilyService.formatForAI(webSearchResults.anime);
      }
    }

    prompt += `\nAvailable Libraries:
${libraries.map((lib, i) => `${i + 1}. ${lib.name} (${lib.media_type})`).join('\n')}

Please respond with ONLY the library number (1-${libraries.length}) and a brief reason (max 100 chars).
Format: NUMBER|REASON
Example: 2|Action movie with high rating`;

    // Get Ollama config
    const configResult = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0] || { model: 'qwen3:14b', temperature: 0.30 };

    const response = await ollamaService.generate(
      prompt,
      config.model,
      parseFloat(config.temperature)
    );

    // Parse AI response
    const match = response.match(/^(\d+)\|(.+)$/m);
    if (match) {
      const libraryIndex = parseInt(match[1]) - 1;
      const reason = match[2].trim();

      if (libraryIndex >= 0 && libraryIndex < libraries.length) {
        return {
          library: libraries[libraryIndex],
          confidence: 75,
          reason: `AI: ${reason}`,
        };
      }
    }

    // Fallback if AI response is malformed
    return {
      library: libraries[0],
      confidence: 60,
      reason: 'AI classification (default)',
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

    return insertResult.rows[0].id;
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
          const movieData = {
            title: metadata.title,
            tmdbId: metadata.tmdb_id,
            year: parseInt(metadata.year),
            qualityProfileId: library.quality_profile_id,
            rootFolderPath: library.root_folder,
            monitored: true,
            addOptions: {
              searchForMovie: true,
            },
          };

          await radarrService.addMovie(config.url, config.api_key, movieData);
          console.log(`Added movie to Radarr: ${metadata.title}`);
        }
      } else if (library.arr_type === 'sonarr') {
        const sonarrConfig = await db.query(
          'SELECT * FROM sonarr_config WHERE id = $1 AND is_active = true',
          [library.arr_id]
        );

        if (sonarrConfig.rows.length > 0) {
          const config = sonarrConfig.rows[0];
          // Note: We'd need to get TVDB ID from TMDB external IDs
          // This is a simplified version
          const seriesData = {
            title: metadata.title,
            tvdbId: metadata.tmdb_id, // This would need proper mapping
            qualityProfileId: library.quality_profile_id,
            rootFolderPath: library.root_folder,
            monitored: true,
            addOptions: {
              searchForMissingEpisodes: true,
            },
          };

          await sonarrService.addSeries(config.url, config.api_key, seriesData);
          console.log(`Added series to Sonarr: ${metadata.title}`);
        }
      }
    } catch (error) {
      console.error('Failed to route to arr:', error);
      // Don't throw - classification was successful even if routing failed
    }
  }
}

module.exports = new ClassificationService();
