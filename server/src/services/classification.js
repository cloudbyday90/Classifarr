const db = require('../db');
const axios = require('axios');

/**
 * Classification Service
 * Handles the complete classification flow for media content
 */
class ClassificationService {
  /**
   * Main classification method
   * @param {Object} mediaData - Media information from TMDB/Overseerr
   * @param {number} mediaData.tmdbId - TMDB ID
   * @param {string} mediaData.mediaType - 'movie' or 'tv'
   * @param {string} mediaData.title - Title of the media
   * @param {number} mediaData.year - Release year
   * @param {Array} mediaData.genres - Array of genre names
   * @param {Array} mediaData.keywords - Array of keywords
   * @param {string} mediaData.certification - Rating (G, PG, R, etc.)
   * @param {Object} mediaData.metadata - Additional metadata
   * @returns {Promise<Object>} Classification result
   */
  async classifyMedia(mediaData) {
    console.log('Starting classification for:', mediaData.title);

    try {
      // Step 1: Check past corrections (exact TMDB ID match)
      const pastCorrection = await this.checkPastCorrections(mediaData.tmdbId, mediaData.mediaType);
      if (pastCorrection) {
        console.log('Found past correction for this media');
        return {
          library: pastCorrection.library,
          libraryId: pastCorrection.libraryId,
          confidence: 100,
          reason: 'Previously corrected by user',
          method: 'past_correction',
          metadata: pastCorrection.metadata,
        };
      }

      // Step 2: Check learned patterns (high confidence)
      const learnedMatch = await this.checkLearnedPatterns(mediaData);
      if (learnedMatch && learnedMatch.confidence >= 85) {
        console.log('High confidence learned pattern match:', learnedMatch.confidence);
        return {
          library: learnedMatch.library,
          libraryId: learnedMatch.libraryId,
          confidence: learnedMatch.confidence,
          reason: learnedMatch.reason,
          method: 'learned_pattern',
          metadata: learnedMatch.metadata,
        };
      }

      // Step 3: Get all libraries and match rules
      const libraries = await this.getLibraries(mediaData.mediaType);
      const ruleMatches = await this.matchRules(mediaData, libraries);

      // Step 4: Calculate confidence for rule matches
      const topMatch = ruleMatches.length > 0 ? ruleMatches[0] : null;
      
      if (topMatch && topMatch.confidence >= 80) {
        console.log('High confidence rule match:', topMatch.confidence);
        return {
          library: topMatch.library,
          libraryId: topMatch.libraryId,
          confidence: topMatch.confidence,
          reason: topMatch.reason,
          method: 'rule_match',
          metadata: topMatch.metadata,
        };
      }

      // Step 5: If confidence < 80%, call AI for decision
      console.log('Low confidence, calling AI classification');
      const aiResult = await this.aiClassify(mediaData, libraries, learnedMatch);
      
      return {
        library: aiResult.library,
        libraryId: aiResult.libraryId,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        method: 'ai_decision',
        metadata: aiResult.metadata,
      };

    } catch (error) {
      console.error('Classification error:', error);
      throw error;
    }
  }

  /**
   * Check if we've corrected this exact title before
   * @param {number} tmdbId - TMDB ID
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Object|null>} Past correction or null
   */
  async checkPastCorrections(tmdbId, mediaType) {
    const result = await db.query(
      `SELECT c.corrected_library_id as library_id, l.name as library_name, c.metadata
       FROM corrections c
       JOIN libraries l ON l.id = c.corrected_library_id
       WHERE c.tmdb_id = $1 AND c.media_type = $2
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [tmdbId, mediaType]
    );

    if (result.rows.length > 0) {
      return {
        libraryId: result.rows[0].library_id,
        library: result.rows[0].library_name,
        metadata: result.rows[0].metadata,
      };
    }

    return null;
  }

  /**
   * Check if learned patterns match this media
   * @param {Object} mediaData - Media information
   * @returns {Promise<Object|null>} Learned pattern match or null
   */
  async checkLearnedPatterns(mediaData) {
    const result = await db.query(
      `SELECT lp.*, l.name as library_name,
              (lp.correct_count::decimal / NULLIF(lp.match_count, 0) * 100) as accuracy
       FROM learned_patterns lp
       JOIN libraries l ON l.id = lp.library_id
       WHERE lp.confidence >= 85
       ORDER BY lp.confidence DESC, accuracy DESC
       LIMIT 10`
    );

    for (const pattern of result.rows) {
      const patternData = pattern.pattern_data;
      
      // Check if pattern matches current media
      if (this.patternMatches(patternData, mediaData)) {
        return {
          libraryId: pattern.library_id,
          library: pattern.library_name,
          confidence: parseFloat(pattern.confidence),
          reason: `Learned pattern: ${pattern.pattern_type}`,
          metadata: patternData,
        };
      }
    }

    return null;
  }

  /**
   * Check if a pattern matches the media data
   * @param {Object} patternData - Pattern data from database
   * @param {Object} mediaData - Media information
   * @returns {boolean} True if pattern matches
   */
  patternMatches(patternData, mediaData) {
    // Genre combination pattern
    if (patternData.genres && mediaData.genres) {
      const patternGenres = patternData.genres.map(g => g.toLowerCase());
      const mediaGenres = mediaData.genres.map(g => g.toLowerCase());
      
      const matchCount = patternGenres.filter(pg => mediaGenres.includes(pg)).length;
      if (matchCount >= patternGenres.length * 0.7) {
        return true;
      }
    }

    // Keyword pattern
    if (patternData.keywords && mediaData.keywords) {
      const patternKeywords = patternData.keywords.map(k => k.toLowerCase());
      const mediaKeywords = mediaData.keywords.map(k => k.toLowerCase());
      
      const matchCount = patternKeywords.filter(pk => 
        mediaKeywords.some(mk => mk.includes(pk) || pk.includes(mk))
      ).length;
      
      if (matchCount > 0) {
        return true;
      }
    }

    // Certification pattern
    if (patternData.certification && mediaData.certification) {
      if (patternData.certification.toLowerCase() === mediaData.certification.toLowerCase()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all libraries for the media type
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Array>} List of libraries
   */
  async getLibraries(mediaType) {
    const result = await db.query(
      `SELECT * FROM libraries WHERE media_type = $1`,
      [mediaType]
    );
    return result.rows;
  }

  /**
   * Match media against library labels and rules
   * @param {Object} mediaData - Media information
   * @param {Array} libraries - List of libraries
   * @returns {Promise<Array>} Sorted matches by confidence
   */
  async matchRules(mediaData, libraries) {
    const matches = [];

    for (const library of libraries) {
      // Get library labels
      const labelsResult = await db.query(
        `SELECT ll.is_include, lp.*
         FROM library_labels ll
         JOIN label_presets lp ON lp.id = ll.label_preset_id
         WHERE ll.library_id = $1`,
        [library.id]
      );

      // Get custom rules
      const rulesResult = await db.query(
        `SELECT * FROM library_custom_rules
         WHERE library_id = $1 AND enabled = true
         ORDER BY priority ASC`,
        [library.id]
      );

      let matchScore = 0;
      let totalRules = 0;
      const matchedRules = [];

      // Check label presets
      for (const label of labelsResult.rows) {
        totalRules++;
        const labelMatches = this.checkLabelMatch(label, mediaData);
        
        if (labelMatches) {
          if (label.is_include) {
            matchScore++;
            matchedRules.push(`${label.display_name} (include)`);
          }
        } else {
          if (!label.is_include) {
            matchScore++;
            matchedRules.push(`Not ${label.display_name} (exclude)`);
          }
        }
      }

      // Check custom rules
      for (const rule of rulesResult.rows) {
        totalRules++;
        const ruleMatches = await this.evaluateCustomRule(rule, mediaData);
        
        if (ruleMatches) {
          if (rule.is_include) {
            matchScore += rule.priority;
            matchedRules.push(`${rule.rule_name} (custom)`);
          }
        } else {
          if (!rule.is_include) {
            matchScore++;
            matchedRules.push(`Not ${rule.rule_name} (custom exclude)`);
          }
        }
      }

      if (totalRules > 0) {
        const confidence = this.calculateConfidence(matchScore, totalRules, matchedRules.length);
        
        if (confidence > 0) {
          matches.push({
            libraryId: library.id,
            library: library.name,
            confidence,
            reason: matchedRules.join(', '),
            metadata: {
              matchScore,
              totalRules,
              matchedRules,
            },
          });
        }
      }
    }

    // Sort by confidence descending
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Check if a label preset matches the media
   * @param {Object} label - Label preset
   * @param {Object} mediaData - Media information
   * @returns {boolean} True if label matches
   */
  checkLabelMatch(label, mediaData) {
    const field = label.tmdb_match_field;
    const values = label.tmdb_match_values;

    if (!field || !values) return false;

    // Check genres
    if (field === 'genres' && mediaData.genres) {
      return mediaData.genres.some(genre => 
        values.some(v => v.toLowerCase() === genre.toLowerCase())
      );
    }

    // Check keywords
    if (field === 'keywords' && mediaData.keywords) {
      return mediaData.keywords.some(keyword => 
        values.some(v => keyword.toLowerCase().includes(v.toLowerCase()))
      );
    }

    // Check certification
    if (field === 'certification' && mediaData.certification) {
      return values.some(v => v.toLowerCase() === mediaData.certification.toLowerCase());
    }

    return false;
  }

  /**
   * Evaluate a custom JSON logic rule
   * @param {Object} rule - Custom rule
   * @param {Object} mediaData - Media information
   * @returns {Promise<boolean>} True if rule matches
   */
  async evaluateCustomRule(rule, mediaData) {
    try {
      const logic = rule.rule_logic;
      
      // Simple JSON logic evaluation
      // This is a basic implementation - in production, use a library like json-rules-engine
      if (logic.and) {
        return logic.and.every(condition => this.evaluateCondition(condition, mediaData));
      }
      
      if (logic.or) {
        return logic.or.some(condition => this.evaluateCondition(condition, mediaData));
      }
      
      return this.evaluateCondition(logic, mediaData);
    } catch (error) {
      console.error('Error evaluating custom rule:', error);
      return false;
    }
  }

  /**
   * Evaluate a single condition
   * @param {Object} condition - Condition to evaluate
   * @param {Object} mediaData - Media information
   * @returns {boolean} True if condition matches
   */
  evaluateCondition(condition, mediaData) {
    const { field, operator, value } = condition;
    const mediaValue = mediaData[field];

    if (!mediaValue) return false;

    switch (operator) {
      case 'equals':
        return mediaValue === value;
      case 'contains':
        if (Array.isArray(mediaValue)) {
          return mediaValue.some(v => v.toLowerCase().includes(value.toLowerCase()));
        }
        return mediaValue.toLowerCase().includes(value.toLowerCase());
      case 'in':
        if (Array.isArray(value)) {
          return value.some(v => {
            if (Array.isArray(mediaValue)) {
              return mediaValue.some(mv => mv.toLowerCase() === v.toLowerCase());
            }
            return mediaValue.toLowerCase() === v.toLowerCase();
          });
        }
        return false;
      case 'greaterThan':
        return parseFloat(mediaValue) > parseFloat(value);
      case 'lessThan':
        return parseFloat(mediaValue) < parseFloat(value);
      default:
        return false;
    }
  }

  /**
   * Calculate confidence score from matches
   * @param {number} matchScore - Number of matched rules
   * @param {number} totalRules - Total number of rules
   * @param {number} matchedCount - Number of rules that matched
   * @returns {number} Confidence percentage (0-100)
   */
  calculateConfidence(matchScore, totalRules, matchedCount) {
    if (totalRules === 0) return 0;
    
    // Base confidence from match ratio
    const baseConfidence = (matchScore / totalRules) * 100;
    
    // Boost if multiple rules matched
    const matchBoost = Math.min(matchedCount * 5, 20);
    
    const confidence = Math.min(baseConfidence + matchBoost, 100);
    return Math.round(confidence);
  }

  /**
   * Use AI (Ollama) to make classification decision
   * @param {Object} mediaData - Media information
   * @param {Array} libraries - Available libraries
   * @param {Object} learnedMatch - Previous learned match (may be low confidence)
   * @returns {Promise<Object>} AI classification result
   */
  async aiClassify(mediaData, libraries, learnedMatch) {
    try {
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';

      const libraryDescriptions = libraries.map(lib => 
        `- ${lib.name}: ${lib.description || 'No description'}`
      ).join('\n');

      const prompt = `You are a media classification expert. Classify the following ${mediaData.mediaType} into the most appropriate library.

Media Information:
- Title: ${mediaData.title}
- Year: ${mediaData.year}
- Genres: ${mediaData.genres?.join(', ') || 'Unknown'}
- Keywords: ${mediaData.keywords?.slice(0, 10).join(', ') || 'None'}
- Rating: ${mediaData.certification || 'Not rated'}

Available Libraries:
${libraryDescriptions}

${learnedMatch ? `Previous Analysis: ${learnedMatch.reason} suggested "${learnedMatch.library}" with ${learnedMatch.confidence}% confidence.` : ''}

Respond with ONLY a JSON object in this exact format:
{
  "library": "library_name",
  "confidence": 75,
  "reason": "Brief explanation of why this library was chosen"
}`;

      const response = await axios.post(`${ollamaHost}/api/generate`, {
        model: ollamaModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
        },
      });

      const aiResponse = response.data.response;
      
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        // Find library ID
        const library = libraries.find(lib => 
          lib.name.toLowerCase() === result.library.toLowerCase()
        );

        if (library) {
          return {
            libraryId: library.id,
            library: library.name,
            confidence: result.confidence,
            reason: result.reason,
            metadata: {
              aiModel: ollamaModel,
              rawResponse: aiResponse,
            },
          };
        }
      }

      // Fallback if AI response parsing fails
      console.error('Failed to parse AI response:', aiResponse);
      return {
        libraryId: libraries[0]?.id,
        library: libraries[0]?.name || 'Default',
        confidence: 50,
        reason: 'AI classification failed, using default library',
        metadata: {
          error: 'Failed to parse AI response',
          rawResponse: aiResponse,
        },
      };

    } catch (error) {
      console.error('AI classification error:', error);
      
      // Fallback to first library
      return {
        libraryId: libraries[0]?.id,
        library: libraries[0]?.name || 'Default',
        confidence: 40,
        reason: 'AI service unavailable, using default library',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  /**
   * Save classification result to database
   * @param {Object} classification - Classification result
   * @param {Object} mediaData - Original media data
   * @returns {Promise<number>} Classification ID
   */
  async saveClassification(classification, mediaData) {
    const result = await db.query(
      `INSERT INTO classifications 
       (tmdb_id, media_type, title, year, library_id, confidence, reason, method, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        mediaData.tmdbId,
        mediaData.mediaType,
        mediaData.title,
        mediaData.year,
        classification.libraryId,
        classification.confidence,
        classification.reason,
        classification.method,
        JSON.stringify(classification.metadata || {}),
      ]
    );

    return result.rows[0].id;
  }
}

module.exports = new ClassificationService();
