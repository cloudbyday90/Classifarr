const db = require('../config/database');
const tmdbService = require('./tmdb');
const ollamaService = require('./ollama');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');
const discordBot = require('./discordBot');
const tavilyService = require('./tavily');
const contentTypeAnalyzer = require('./contentTypeAnalyzer');

class ClassificationService {
  async classify(overseerrPayload) {
    try {
      // Parse Overseerr payload
      const { media_type, tmdbId, subject } = this.parseOverseerrPayload(overseerrPayload);
      
      console.log(`Starting classification for ${media_type}: ${subject} (TMDB: ${tmdbId})`);

      // Enrich with TMDB metadata
      const metadata = await this.enrichWithTMDB(tmdbId, media_type);
      
      // Check if content analysis is enabled
      const contentAnalysisEnabled = await this.isContentAnalysisEnabled();
      
      // Analyze content type to prevent false positives
      if (contentAnalysisEnabled) {
        const contentAnalysis = contentTypeAnalyzer.analyze(metadata);
        
        // Add analysis to metadata for use in classification
        metadata.content_analysis = contentAnalysis;
        
        // If content analysis detected a specific type with high confidence,
        // add suggested labels to metadata for rule matching
        const minConfidence = await this.getContentAnalysisMinConfidence();
        if (contentAnalysis.detected_type && contentAnalysis.confidence >= minConfidence) {
          metadata.detected_content_type = contentAnalysis.detected_type;
          metadata.content_type_labels = contentAnalysis.suggested_labels;
          
          // Log the override if applicable
          if (contentAnalysis.overrides_genre) {
            console.log(`Content analysis overriding genre for "${metadata.title}": ${contentAnalysis.reasoning.join('; ')}`);
          }
        }
      }
      
      // Run decision tree with enhanced metadata
      const result = await this.runDecisionTree(metadata, media_type);

      // Log to database
      const classificationId = await this.logClassification(metadata, result);
      
      // Log content analysis if enabled
      if (contentAnalysisEnabled && metadata.content_analysis && metadata.content_analysis.detected_type) {
        await this.logContentAnalysis(classificationId, metadata, metadata.content_analysis);
      }

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

      // Check if content analysis suggests this library
      if (metadata.content_type_labels && metadata.content_type_labels.length > 0) {
        for (const label of labels.filter(l => l.rule_type === 'include')) {
          // Check if any content type label matches library labels
          if (metadata.content_type_labels.includes(label.name)) {
            score += 35; // Higher weight for content-analyzed matches
            reasons.push(`Content analysis: ${metadata.detected_content_type} matches ${label.display_name}`);
          }
        }
      }

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

    // Add content analysis to AI prompt if available
    if (metadata.content_analysis && metadata.content_analysis.detected_type) {
      prompt += `
--- Content Analysis ---
Detected Type: ${metadata.content_analysis.detected_type}
Confidence: ${metadata.content_analysis.confidence}%
Reasoning: ${metadata.content_analysis.reasoning.join('; ')}
${metadata.content_analysis.overrides_genre ? 'Note: This overrides the surface-level genre tags.' : ''}
`;
    }

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

  async isContentAnalysisEnabled() {
    try {
      const result = await db.query(
        "SELECT value FROM settings WHERE key = 'content_analysis_enabled' LIMIT 1"
      );
      return result.rows.length > 0 && result.rows[0].value === 'true';
    } catch (error) {
      console.error('Error checking content analysis setting:', error);
      return true; // Default to enabled
    }
  }

  async getContentAnalysisMinConfidence() {
    try {
      const result = await db.query(
        "SELECT value FROM settings WHERE key = 'content_analysis_min_confidence' LIMIT 1"
      );
      return result.rows.length > 0 ? parseInt(result.rows[0].value) : 75;
    } catch (error) {
      console.error('Error getting content analysis min confidence:', error);
      return 75; // Default value
    }
  }

  async logContentAnalysis(classificationId, metadata, analysis) {
    try {
      await db.query(
        `INSERT INTO content_analysis_log 
         (classification_id, tmdb_id, title, original_genres, detected_type, confidence, 
          overrides_genre, reasoning, suggested_labels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          classificationId,
          metadata.tmdb_id,
          metadata.title,
          analysis.original_genres,
          analysis.detected_type,
          analysis.confidence,
          analysis.overrides_genre,
          analysis.reasoning,
          analysis.suggested_labels
        ]
      );
    } catch (error) {
      console.error('Error logging content analysis:', error);
      // Don't throw - this is not critical
    }
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
