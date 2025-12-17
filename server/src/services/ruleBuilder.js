const ollamaService = require('./ollama');
const { query } = require('../config/database');

// In-memory session storage (could be moved to Redis in production)
const sessions = new Map();

class RuleBuilderService {
  /**
   * Start a new rule building session
   */
  async startSession(libraryId, mediaType, userId) {
    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get library details
    const libResult = await query('SELECT * FROM libraries WHERE id = $1', [libraryId]);
    if (libResult.rows.length === 0) {
      throw new Error('Library not found');
    }

    const library = libResult.rows[0];

    // Initialize session
    const session = {
      id: sessionId,
      libraryId,
      library,
      mediaType,
      userId,
      messages: [],
      context: {},
      createdAt: new Date(),
      lastActivity: new Date()
    };

    sessions.set(sessionId, session);

    // Start conversation
    const initialMessage = await this.generateInitialMessage(library, mediaType);
    session.messages.push({
      role: 'assistant',
      content: initialMessage
    });

    return {
      sessionId,
      message: initialMessage
    };
  }

  /**
   * Process user message in session
   */
  async processMessage(sessionId, userMessage) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found or expired');
    }

    // Update last activity
    session.lastActivity = new Date();

    // Add user message
    session.messages.push({
      role: 'user',
      content: userMessage
    });

    // Generate AI response
    const aiResponse = await this.generateResponse(session);
    
    session.messages.push({
      role: 'assistant',
      content: aiResponse.message
    });

    // Update context based on response
    if (aiResponse.context) {
      session.context = { ...session.context, ...aiResponse.context };
    }

    return {
      message: aiResponse.message,
      context: session.context,
      readyToGenerate: aiResponse.readyToGenerate || false
    };
  }

  /**
   * Generate rule from session context
   */
  async generateRule(sessionId, ruleName) {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const rule = this.buildRuleFromContext(session.context, ruleName);
    
    // Save rule to database
    const result = await query(`
      INSERT INTO library_custom_rules (
        library_id, name, description, rule_json, media_type, 
        priority, enabled, generated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      session.libraryId,
      ruleName || `Auto-generated rule ${Date.now()}`,
      session.context.description || 'AI-generated rule',
      JSON.stringify(rule),
      session.mediaType,
      0,
      true,
      'ai_chatbot'
    ]);

    // Clean up session
    sessions.delete(sessionId);

    return result.rows[0];
  }

  /**
   * Test a rule against sample media
   */
  async testRule(rule, sampleMedia) {
    // Get recent classifications as sample data
    let samples;
    
    if (sampleMedia && Array.isArray(sampleMedia)) {
      samples = sampleMedia;
    } else {
      const result = await query(`
        SELECT metadata FROM classification_history
        WHERE media_type = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [rule.media_type]);
      
      samples = result.rows.map(r => r.metadata);
    }

    // Test rule against samples
    const results = samples.map(sample => {
      const matches = this.evaluateRule(rule.rule_json, sample);
      return {
        title: sample.title,
        year: sample.year,
        matches
      };
    });

    return {
      totalSamples: samples.length,
      matches: results.filter(r => r.matches).length,
      results
    };
  }

  /**
   * Evaluate rule against metadata
   */
  evaluateRule(ruleJson, metadata) {
    try {
      for (const [key, value] of Object.entries(ruleJson)) {
        if (Array.isArray(value)) {
          // OR condition - match any
          if (!value.some(v => this.matchValue(metadata, key, v))) {
            return false;
          }
        } else if (typeof value === 'object' && value !== null) {
          // Range condition
          if (value.min !== undefined && metadata[key] < value.min) return false;
          if (value.max !== undefined && metadata[key] > value.max) return false;
        } else {
          // Exact match
          if (!this.matchValue(metadata, key, value)) {
            return false;
          }
        }
      }
      return true;
    } catch (err) {
      console.error('Rule evaluation error:', err);
      return false;
    }
  }

  /**
   * Match a single value
   */
  matchValue(metadata, key, value) {
    const metadataValue = metadata[key];
    
    if (Array.isArray(metadataValue)) {
      return metadataValue.includes(value);
    }
    
    return metadataValue === value;
  }

  /**
   * Generate initial message for conversation
   */
  async generateInitialMessage(library, mediaType) {
    return `Hi! I'll help you create a custom classification rule for the **${library.name}** library.

Let's define what kind of ${mediaType === 'tv' ? 'TV shows' : 'movies'} should go into this library.

To get started, please tell me:
1. What genres should this library include? (e.g., Action, Comedy, Horror)
2. Are there specific content ratings? (e.g., PG, R, TV-MA)
3. Any other characteristics? (e.g., release year range, keywords, themes)

Feel free to describe it in your own words, and I'll ask clarifying questions!`;
  }

  /**
   * Generate AI response based on conversation
   */
  async generateResponse(session) {
    const systemPrompt = `You are a helpful assistant creating media classification rules. 
The user is defining rules for the "${session.library.name}" library for ${session.mediaType} content.

Your job:
1. Ask clarifying questions to understand their criteria
2. Extract specific attributes: genres, ratings, keywords, year ranges
3. When you have enough information, indicate you're ready to generate the rule
4. Be conversational and helpful

Current context: ${JSON.stringify(session.context)}

If the user has provided enough information (genres, ratings, or other specific criteria), 
respond with "READY_TO_GENERATE" at the end of your message.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...session.messages
    ];

    try {
      const response = await ollamaService.chat(messages);
      
      // Extract context from conversation
      const newContext = this.extractContextFromResponse(session.messages[session.messages.length - 1].content, response);
      
      // Check if ready to generate
      const readyToGenerate = response.includes('READY_TO_GENERATE');
      
      return {
        message: response.replace('READY_TO_GENERATE', '').trim(),
        context: newContext,
        readyToGenerate
      };
    } catch (err) {
      console.error('AI response generation failed:', err);
      return {
        message: 'I apologize, but I encountered an error. Could you please rephrase your requirements?',
        context: {},
        readyToGenerate: false
      };
    }
  }

  /**
   * Extract context from user message and AI response
   */
  extractContextFromResponse(userMessage, aiResponse) {
    const context = {};
    const combinedText = (userMessage + ' ' + aiResponse).toLowerCase();

    // Extract genres
    const genres = ['action', 'comedy', 'drama', 'horror', 'thriller', 'romance', 
                   'science fiction', 'fantasy', 'documentary', 'animation', 'crime', 'mystery'];
    const foundGenres = genres.filter(g => combinedText.includes(g));
    if (foundGenres.length > 0) {
      context.genres = foundGenres;
    }

    // Extract ratings
    const ratings = ['g', 'pg', 'pg-13', 'r', 'nc-17', 'tv-y', 'tv-y7', 'tv-g', 'tv-pg', 'tv-14', 'tv-ma'];
    const foundRatings = ratings.filter(r => combinedText.includes(r));
    if (foundRatings.length > 0) {
      context.ratings = foundRatings;
    }

    // Extract year range
    const yearMatch = combinedText.match(/(\d{4})\s*-\s*(\d{4})/);
    if (yearMatch) {
      context.yearRange = {
        min: parseInt(yearMatch[1]),
        max: parseInt(yearMatch[2])
      };
    }

    return context;
  }

  /**
   * Build rule JSON from context
   */
  buildRuleFromContext(context, description) {
    const rule = {};

    if (context.genres && context.genres.length > 0) {
      rule.genres = context.genres;
    }

    if (context.ratings && context.ratings.length > 0) {
      rule.rating = context.ratings;
    }

    if (context.yearRange) {
      rule.year = context.yearRange;
    }

    if (context.keywords && context.keywords.length > 0) {
      rule.keywords = context.keywords;
    }

    return rule;
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions() {
    const now = new Date();
    const expirationTime = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastActivity > expirationTime) {
        sessions.delete(sessionId);
      }
    }
  }
}

// Cleanup old sessions periodically
setInterval(() => {
  const service = new RuleBuilderService();
  service.cleanupSessions();
}, 5 * 60 * 1000); // Every 5 minutes

module.exports = new RuleBuilderService();
