const { query } = require('../config/database');
const tmdbService = require('./tmdb');
const ollamaService = require('./ollama');
const radarrService = require('./radarr');
const sonarrService = require('./sonarr');

class ClassificationService {
  /**
   * Main classification entry point
   */
  async classify(overseerrPayload) {
    console.log('🎬 Starting classification for:', overseerrPayload.media?.title);

    try {
      const mediaType = overseerrPayload.media.media_type || 'movie';
      const tmdbId = overseerrPayload.media.tmdbId;
      const requestedBy = overseerrPayload.request?.requestedBy_username || 'unknown';

      // Step 1: Enrich metadata from TMDB
      const metadata = await this.enrichMetadata(tmdbId, mediaType);
      metadata.requestedBy = requestedBy;
      metadata.overseerrRequestId = overseerrPayload.request?.request_id;

      // Step 2: Run decision tree
      const result = await this.runDecisionTree(metadata, mediaType);

      // Step 3: Route to *arr if library assigned
      if (result.library) {
        await this.routeToArr(metadata, result.library, mediaType);
      }

      // Step 4: Log classification
      await this.logClassification(metadata, result, requestedBy);

      console.log(`✓ Classification complete: ${metadata.title} → ${result.library?.name || 'Unassigned'}`);
      return result;

    } catch (err) {
      console.error('Classification error:', err);
      throw err;
    }
  }

  /**
   * Enrich metadata from TMDB
   */
  async enrichMetadata(tmdbId, mediaType) {
    try {
      if (mediaType === 'tv') {
        return await tmdbService.getTVDetails(tmdbId);
      } else {
        return await tmdbService.getMovieDetails(tmdbId);
      }
    } catch (err) {
      console.error('Failed to enrich metadata:', err.message);
      return {
        tmdbId,
        title: 'Unknown',
        mediaType,
        error: err.message
      };
    }
  }

  /**
   * Decision tree for classification
   */
  async runDecisionTree(metadata, mediaType) {
    // Get all enabled libraries for this media type
    const libraries = await this.getEnabledLibraries(mediaType);

    if (libraries.length === 0) {
      return {
        library: null,
        confidence: 0,
        method: 'no_libraries',
        reason: 'No libraries configured for this media type'
      };
    }

    // Step 1: Check exact match (previously corrected)
    const exactMatch = await this.checkExactMatch(metadata.tmdbId, mediaType);
    if (exactMatch) {
      return {
        library: exactMatch,
        confidence: 100,
        method: 'exact_match',
        reason: 'Previously corrected by user'
      };
    }

    // Step 2: Check learned patterns
    const learnedPattern = await this.checkLearnedPatterns(metadata, libraries);
    if (learnedPattern && learnedPattern.confidence >= 80) {
      return {
        library: learnedPattern.library,
        confidence: learnedPattern.confidence,
        method: 'learned_pattern',
        reason: learnedPattern.reason
      };
    }

    // Step 3: Match rules
    const ruleMatch = await this.matchRules(metadata, libraries);
    if (ruleMatch && ruleMatch.confidence >= 70) {
      return {
        library: ruleMatch.library,
        confidence: ruleMatch.confidence,
        method: 'rule_match',
        reason: ruleMatch.reason
      };
    }

    // Step 4: AI classification (Ollama)
    const aiMatch = await this.aiClassify(metadata, libraries);
    return {
      library: aiMatch.library,
      confidence: aiMatch.confidence,
      method: 'ai_classification',
      reason: aiMatch.reason
    };
  }

  /**
   * Get enabled libraries for media type
   */
  async getEnabledLibraries(mediaType) {
    const result = await query(`
      SELECT 
        l.*,
        array_agg(lp.name) FILTER (WHERE lp.name IS NOT NULL) as labels
      FROM libraries l
      LEFT JOIN library_labels ll ON l.id = ll.library_id
      LEFT JOIN label_presets lp ON ll.label_id = lp.id
      WHERE l.enabled = true
        AND (l.media_type = $1 OR l.media_type = 'mixed')
      GROUP BY l.id
    `, [mediaType]);

    return result.rows;
  }

  /**
   * Check for exact match (previously corrected)
   */
  async checkExactMatch(tmdbId, mediaType) {
    const result = await query(`
      SELECT l.* 
      FROM classification_corrections cc
      JOIN classification_history ch ON cc.classification_id = ch.id
      JOIN libraries l ON cc.corrected_library_id = l.id
      WHERE ch.tmdb_id = $1 
        AND ch.media_type = $2
        AND l.enabled = true
      ORDER BY cc.created_at DESC
      LIMIT 1
    `, [tmdbId, mediaType]);

    return result.rows[0] || null;
  }

  /**
   * Check learned patterns
   */
  async checkLearnedPatterns(metadata, libraries) {
    const patterns = await query(`
      SELECT 
        lp.*,
        l.id as library_id,
        l.name as library_name
      FROM learning_patterns lp
      JOIN libraries l ON lp.library_id = l.id
      WHERE l.enabled = true
      ORDER BY lp.confidence_score DESC, lp.occurrence_count DESC
    `);

    for (const pattern of patterns.rows) {
      const match = this.evaluatePattern(pattern, metadata);
      if (match) {
        return {
          library: libraries.find(l => l.id === pattern.library_id),
          confidence: pattern.confidence_score,
          reason: `Learned pattern: ${pattern.pattern_type}`
        };
      }
    }

    return null;
  }

  /**
   * Evaluate a learned pattern against metadata
   */
  evaluatePattern(pattern, metadata) {
    switch (pattern.pattern_type) {
      case 'genre':
        return metadata.genres?.includes(pattern.pattern_value);
      case 'keyword':
        return metadata.keywords?.includes(pattern.pattern_value);
      case 'rating':
        return metadata.rating === pattern.pattern_value;
      case 'year_range':
        const [minYear, maxYear] = pattern.pattern_value.split('-').map(Number);
        return metadata.year >= minYear && metadata.year <= maxYear;
      default:
        return false;
    }
  }

  /**
   * Match against custom rules
   */
  async matchRules(metadata, libraries) {
    const rules = await query(`
      SELECT r.*, l.id as library_id
      FROM library_custom_rules r
      JOIN libraries l ON r.library_id = l.id
      WHERE r.enabled = true 
        AND l.enabled = true
      ORDER BY r.priority DESC
    `);

    for (const rule of rules.rows) {
      const match = this.evaluateCustomRule(rule.rule_json, metadata);
      if (match) {
        const library = libraries.find(l => l.id === rule.library_id);
        return {
          library,
          confidence: 85,
          reason: `Rule match: ${rule.name}`
        };
      }
    }

    return null;
  }

  /**
   * Evaluate custom rule (simple JSON logic)
   */
  evaluateCustomRule(ruleJson, metadata) {
    try {
      // Simple rule evaluation
      // Example rule: { "genre": "Action", "rating": ["R", "PG-13"] }
      for (const [key, value] of Object.entries(ruleJson)) {
        if (Array.isArray(value)) {
          if (!value.includes(metadata[key])) {
            return false;
          }
        } else if (key === 'genres' || key === 'keywords') {
          if (!metadata[key]?.includes(value)) {
            return false;
          }
        } else if (metadata[key] !== value) {
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Rule evaluation error:', err.message);
      return false;
    }
  }

  /**
   * AI classification using Ollama
   */
  async aiClassify(metadata, libraries) {
    try {
      return await ollamaService.classifyMedia(metadata, libraries);
    } catch (err) {
      console.error('AI classification failed:', err.message);
      // Fallback to first library
      return {
        library: libraries[0],
        confidence: 50,
        reason: 'Fallback classification (AI failed)'
      };
    }
  }

  /**
   * Route to Radarr or Sonarr
   */
  async routeToArr(metadata, library, mediaType) {
    try {
      let result;
      
      if (mediaType === 'movie') {
        const config = await radarrService.getConfig(library.id);
        if (config) {
          result = await radarrService.addMovie(config, metadata);
        }
      } else {
        const config = await sonarrService.getConfig(library.id);
        if (config) {
          result = await sonarrService.addSeries(config, metadata);
        }
      }

      return result;
    } catch (err) {
      console.error('Failed to route to *arr:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Log classification to database
   */
  async logClassification(metadata, result, requestedBy) {
    await query(`
      INSERT INTO classification_history (
        tmdb_id, media_type, title, year, metadata,
        assigned_library_id, confidence_score, classification_method,
        reason, requested_by, overseerr_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      metadata.tmdbId,
      metadata.mediaType || 'movie',
      metadata.title,
      metadata.year,
      JSON.stringify(metadata),
      result.library?.id || null,
      result.confidence,
      result.method,
      result.reason,
      requestedBy,
      metadata.overseerrRequestId
    ]);
  }
}

module.exports = new ClassificationService();
