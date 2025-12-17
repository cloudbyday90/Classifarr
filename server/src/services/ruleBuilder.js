const ollamaService = require('./ollama');
const db = require('../config/database');

// In-memory session storage (in production, use Redis or database)
const sessions = new Map();

class RuleBuilderService {
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
