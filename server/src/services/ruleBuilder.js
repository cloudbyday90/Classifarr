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

const contentTypeAnalyzer = require('./contentTypeAnalyzer');

class RuleBuilderService {
  async analyzeLibrary(libraryId) {
    try {
      const itemsResult = await db.query(
        `SELECT msi.id, msi.title, msi.metadata, msi.genres, msi.tags, msi.content_rating, msi.tmdb_id,
                l.media_type
         FROM media_server_items msi
         JOIN libraries l ON msi.library_id = l.id
         WHERE msi.library_id = $1 AND msi.metadata->'content_analysis' IS NULL`,
        [libraryId]
      );

      const queueService = require('./queueService');
      let queuedCount = 0;

      for (const item of itemsResult.rows) {
        await queueService.enqueue('classification', {
          title: item.title,
          overview: item.metadata?.summary || '',
          genres: typeof item.genres === 'string' ? JSON.parse(item.genres) : (item.genres || []),
          keywords: typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []),
          content_rating: item.content_rating,
          original_language: 'en',
          tmdb_id: item.tmdb_id,
          itemId: item.id,
          media: { media_type: item.media_type || 'movie' } // Include media_type for correct TMDB lookup
        }, {
          priority: 5,
          source: 'manual_trigger'
        });
        queuedCount++;
      }

      return { success: true, queued: queuedCount, message: `Queued ${queuedCount} items for analysis` };
    } catch (error) {
      console.error('Error analyzing library:', error);
      throw error;
    }
  }

  async startSession(libraryId, mediaType) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Get library info
    const libResult = await db.query('SELECT * FROM libraries WHERE id = $1', [libraryId]);
    if (libResult.rows.length === 0) {
      throw new Error('Library not found');
    }

    const library = libResult.rows[0];

    const session = {
      id: sessionId,
      libraryId,
      libraryName: library.name,
      mediaType,
      messages: [],
      ruleData: {},
      createdAt: new Date(),
    };

    sessions.set(sessionId, session);

    // Initial AI greeting
    const greeting = `Hello! I'm here to help you create a custom classification rule for your "${library.name}" library (${mediaType}s).

I'll ask you some questions to understand what kind of content should go into this library. We can create rules based on:
- Genres (e.g., Action, Comedy, Horror)
- Ratings (e.g., PG-13, R, TV-MA)
- Keywords (e.g., superhero, space, romance)
- Popularity or rating scores
- Original language
- Release year ranges

What kind of ${mediaType}s should go into "${library.name}"?`;

    session.messages.push({
      role: 'assistant',
      content: greeting,
    });

    return {
      sessionId,
      message: greeting,
    };
  }

  async processMessage(sessionId, userMessage) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    // Add user message to history
    session.messages.push({
      role: 'user',
      content: userMessage,
    });

    // Build conversation context for AI
    const context = this.buildContext(session);

    // Get Ollama config
    const configResult = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
    const config = configResult.rows[0] || { model: 'qwen3:14b', temperature: 0.30 };

    // Generate AI response
    const aiResponse = await ollamaService.generate(context, config.model, parseFloat(config.temperature));

    // Extract any rule data from the conversation
    this.extractRuleData(session, userMessage, aiResponse);

    // Add AI response to history
    session.messages.push({
      role: 'assistant',
      content: aiResponse,
    });

    // Check if we have enough information to generate a rule
    const canGenerate = this.hasEnoughInformation(session);

    return {
      message: aiResponse,
      canGenerateRule: canGenerate,
      extractedData: session.ruleData,
    };
  }

  buildContext(session) {
    const conversationHistory = session.messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    return `You are a helpful assistant helping to build media classification rules. 
You are having a conversation with a user about their "${session.libraryName}" library for ${session.mediaType}s.

Your goal is to ask clarifying questions and gather information about:
1. What genres should be included or excluded
2. What ratings/certifications are preferred
3. Any specific keywords or themes
4. Any popularity or rating thresholds
5. Language preferences
6. Year ranges

Be conversational and ask one or two questions at a time. When you have enough information, suggest creating the rule.

Conversation so far:
${conversationHistory}

Respond naturally and ask relevant follow-up questions. Keep responses concise (2-3 sentences).`;
  }

  extractRuleData(session, userMessage, aiResponse) {
    const lowerMessage = userMessage.toLowerCase();

    // Extract genres
    const genreKeywords = ['action', 'comedy', 'drama', 'horror', 'sci-fi', 'fantasy', 'thriller', 'romance', 'documentary', 'animation', 'anime'];
    for (const genre of genreKeywords) {
      if (lowerMessage.includes(genre)) {
        if (!session.ruleData.genres) session.ruleData.genres = [];
        if (!session.ruleData.genres.includes(genre)) {
          session.ruleData.genres.push(genre);
        }
      }
    }

    // Extract ratings
    const ratingKeywords = ['g', 'pg', 'pg-13', 'r', 'nc-17', 'tv-y', 'tv-y7', 'tv-g', 'tv-pg', 'tv-14', 'tv-ma'];
    for (const rating of ratingKeywords) {
      if (lowerMessage.includes(rating)) {
        if (!session.ruleData.ratings) session.ruleData.ratings = [];
        if (!session.ruleData.ratings.includes(rating.toUpperCase())) {
          session.ruleData.ratings.push(rating.toUpperCase());
        }
      }
    }

    // Extract keywords from quotes
    const quotedMatches = userMessage.match(/"([^"]+)"/g);
    if (quotedMatches) {
      if (!session.ruleData.keywords) session.ruleData.keywords = [];
      quotedMatches.forEach(match => {
        const keyword = match.replace(/"/g, '');
        if (!session.ruleData.keywords.includes(keyword)) {
          session.ruleData.keywords.push(keyword);
        }
      });
    }

    // Extract year ranges
    const yearMatch = userMessage.match(/(\d{4})\s*-\s*(\d{4})/);
    if (yearMatch) {
      session.ruleData.yearRange = {
        from: parseInt(yearMatch[1]),
        to: parseInt(yearMatch[2]),
      };
    }

    // Extract language
    const langMatch = lowerMessage.match(/\b(english|japanese|korean|spanish|french|german|italian)\b/);
    if (langMatch) {
      session.ruleData.language = langMatch[1];
    }
  }

  hasEnoughInformation(session) {
    const data = session.ruleData;
    // Need at least one criterion
    return data.genres?.length > 0 ||
      data.ratings?.length > 0 ||
      data.keywords?.length > 0 ||
      data.yearRange ||
      data.language;
  }

  async generateRule(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    if (!this.hasEnoughInformation(session)) {
      throw new Error('Not enough information to generate rule');
    }

    const data = session.ruleData;
    const conditions = [];

    // Build rule conditions
    if (data.genres?.length > 0) {
      conditions.push({
        field: 'genres',
        operator: 'contains',
        value: data.genres[0], // Use first genre as primary
      });
    }

    if (data.ratings?.length > 0) {
      conditions.push({
        field: 'certification',
        operator: 'equals',
        value: data.ratings[0],
      });
    }

    if (data.keywords?.length > 0) {
      conditions.push({
        field: 'keywords',
        operator: 'contains',
        value: data.keywords[0],
      });
    }

    if (data.yearRange) {
      conditions.push({
        field: 'year',
        operator: 'greater_than',
        value: data.yearRange.from,
      });
      conditions.push({
        field: 'year',
        operator: 'less_than',
        value: data.yearRange.to,
      });
    }

    if (data.language) {
      conditions.push({
        field: 'original_language',
        operator: 'equals',
        value: this.getLanguageCode(data.language),
      });
    }

    // Create rule name and description
    const ruleName = this.generateRuleName(data);
    const ruleDescription = this.generateRuleDescription(data);

    // Save to database
    const result = await db.query(
      `INSERT INTO library_custom_rules (library_id, name, description, rule_json, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [session.libraryId, ruleName, ruleDescription, JSON.stringify(conditions[0] || {}), true]
    );

    // Clean up session
    sessions.delete(sessionId);

    return result.rows[0];
  }

  generateRuleName(data) {
    const parts = [];
    if (data.genres?.length > 0) parts.push(data.genres[0]);
    if (data.ratings?.length > 0) parts.push(data.ratings[0]);
    if (data.keywords?.length > 0) parts.push(data.keywords[0]);
    return parts.join(' + ') || 'Custom Rule';
  }

  generateRuleDescription(data) {
    const parts = [];
    if (data.genres?.length > 0) parts.push(`Genres: ${data.genres.join(', ')}`);
    if (data.ratings?.length > 0) parts.push(`Ratings: ${data.ratings.join(', ')}`);
    if (data.keywords?.length > 0) parts.push(`Keywords: ${data.keywords.join(', ')}`);
    if (data.yearRange) parts.push(`Years: ${data.yearRange.from}-${data.yearRange.to}`);
    if (data.language) parts.push(`Language: ${data.language}`);
    return parts.join(' | ') || 'Custom classification rule';
  }

  getLanguageCode(language) {
    const codes = {
      english: 'en',
      japanese: 'ja',
      korean: 'ko',
      spanish: 'es',
      french: 'fr',
      german: 'de',
      italian: 'it',
    };
    return codes[language.toLowerCase()] || 'en';
  }

  async previewRule(libraryId, criteria) {
    try {
      let query = 'SELECT * FROM media_server_items WHERE library_id = $1';
      const params = [libraryId];
      let paramIndex = 2;

      // Handle criteria array
      if (!Array.isArray(criteria)) {
        criteria = [criteria];
      }

      for (const condition of criteria) {
        const { field, operator, value } = condition;

        if (!value || (Array.isArray(value) && value.length === 0)) continue;

        switch (field) {
          case 'content_type':
            if (operator === 'is_one_of') {
              const types = Array.isArray(value) ? value : [value];
              query += ` AND metadata->'content_analysis'->>'type' = ANY($${paramIndex})`;
              params.push(types);
            } else {
              query += ` AND metadata->'content_analysis'->>'type' = $${paramIndex}`;
              params.push(value);
            }
            paramIndex++;
            break;

          case 'genres':
            if (operator === 'contains') {
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
              params.push(value);
              paramIndex++;
            } else if (operator === 'is_one_of') {
              // Check if ANY of the genres in the value list match ANY of the item's genres
              // This is complex in SQL with jsonb array vs array. 
              // Simplest: EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) g WHERE g = ANY($1))
              const genres = Array.isArray(value) ? value : [value];
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = ANY(SELECT LOWER(unnest($${paramIndex}::text[]))))`;
              params.push(genres);
              paramIndex++;
            } else if (operator === 'not_contains') {
              query += ` AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(genres) AS g WHERE LOWER(g) = LOWER($${paramIndex}))`;
              params.push(value);
              paramIndex++;
            }
            break;

          case 'keywords':
          case 'tags':
            if (operator === 'contains') {
              query += ` AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(tags) AS t WHERE LOWER(t) LIKE LOWER($${paramIndex}))`;
              params.push(`%${value}%`);
              paramIndex++;
            }
            break;

          case 'title':
            if (operator === 'contains') {
              query += ` AND LOWER(title) LIKE LOWER($${paramIndex})`;
              params.push(`%${value}%`);
              paramIndex++;
            }
            break;

          case 'year':
            if (operator === 'equals') {
              query += ` AND year = $${paramIndex}`;
              params.push(parseInt(value));
            } else if (operator === 'greater_than') {
              query += ` AND year > $${paramIndex}`;
              params.push(parseInt(value));
            } else if (operator === 'less_than') {
              query += ` AND year < $${paramIndex}`;
              params.push(parseInt(value));
            }
            paramIndex++;
            break;

          case 'certification':
            if (operator === 'equals') {
              query += ` AND (metadata->>'content_rating' = $${paramIndex} OR metadata->>'certification' = $${paramIndex})`;
              params.push(value);
            } else if (operator === 'is_one_of') {
              const certs = Array.isArray(value) ? value : [value];
              query += ` AND (metadata->>'content_rating' = ANY($${paramIndex}) OR metadata->>'certification' = ANY($${paramIndex}))`;
              params.push(certs);
            }
            paramIndex++;
            break;
        }
      }

      query += ' ORDER BY added_at DESC LIMIT 20';

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error in previewRule:', error);
      throw new Error(`Failed to preview rule: ${error.message}`);
    }
  }

  async getAnalysisStats(libraryId) {
    try {
      // Count total items
      const totalResult = await db.query(
        'SELECT COUNT(*) FROM media_server_items WHERE library_id = $1',
        [libraryId]
      );

      // Count items with analysis
      const analyzedResult = await db.query(
        `SELECT COUNT(*) FROM media_server_items 
         WHERE library_id = $1 AND metadata->'content_analysis' IS NOT NULL`,
        [libraryId]
      );

      // Group by detected type
      const typesResult = await db.query(
        `SELECT metadata->'content_analysis'->>'type' as type, COUNT(*) as count 
         FROM media_server_items 
         WHERE library_id = $1 AND metadata->'content_analysis' IS NOT NULL
         GROUP BY type
         ORDER BY count DESC`,
        [libraryId]
      );

      return {
        total: parseInt(totalResult.rows[0].count),
        analyzed: parseInt(analyzedResult.rows[0].count),
        types: typesResult.rows.map(r => ({ type: r.type, count: parseInt(r.count) }))
      };
    } catch (error) {
      console.error('Error getting analysis stats:', error);
      return { total: 0, analyzed: 0, types: [] };
    }
  }

  async testRule(rule, sampleData) {
    // Test the rule against sample metadata
    try {
      const { field, operator, value } = rule.rule_json;
      const fieldValue = sampleData[field];

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
      return false;
    }
  }

  // Clean up old sessions (call periodically)
  cleanupSessions() {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
      const age = now - session.createdAt;
      if (age > 3600000) { // 1 hour
        sessions.delete(sessionId);
      }
    }
  }
}

module.exports = new RuleBuilderService();
