const db = require('../db');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * Rule Builder Chatbot Service
 * Helps users build custom classification rules through conversation
 */
class RuleBuilderService {
  /**
   * Start a new rule-building conversation
   * @param {number} libraryId - Library ID
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Object>} Session information
   */
  async startConversation(libraryId, mediaType) {
    const sessionId = uuidv4();
    
    // Get library info
    const libraryResult = await db.query(
      'SELECT * FROM libraries WHERE id = $1',
      [libraryId]
    );

    if (libraryResult.rows.length === 0) {
      throw new Error('Library not found');
    }

    const library = libraryResult.rows[0];

    const initialMessage = `Hello! I'll help you create a custom rule for your "${library.name}" library.

Let's start with a simple question: What kind of ${mediaType === 'movie' ? 'movies' : 'TV shows'} should go into this library?

For example, you might say:
- "Action movies with high ratings"
- "Animated shows for kids"
- "Horror movies but not too scary"
- "Documentaries about science"

Tell me what you're looking for!`;

    const conversation = [
      {
        role: 'assistant',
        message: initialMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    await db.query(
      `INSERT INTO rule_builder_sessions (session_id, library_id, media_type, conversation, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, libraryId, mediaType, JSON.stringify(conversation), 'active']
    );

    return {
      sessionId,
      libraryId,
      library: library.name,
      mediaType,
      message: initialMessage,
    };
  }

  /**
   * Process user message and generate response
   * @param {string} sessionId - Session ID
   * @param {string} userMessage - User's message
   * @returns {Promise<Object>} Response and updated conversation
   */
  async processMessage(sessionId, userMessage) {
    // Get session
    const sessionResult = await db.query(
      'SELECT * FROM rule_builder_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];
    const conversation = session.conversation;

    // Add user message to conversation
    conversation.push({
      role: 'user',
      message: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Get AI response
    const aiResponse = await this.getAIResponse(conversation, session.media_type);

    // Add AI response to conversation
    conversation.push({
      role: 'assistant',
      message: aiResponse.message,
      timestamp: new Date().toISOString(),
    });

    // Update session
    await db.query(
      `UPDATE rule_builder_sessions 
       SET conversation = $1, updated_at = NOW(), rule_draft = $2
       WHERE session_id = $3`,
      [JSON.stringify(conversation), JSON.stringify(aiResponse.ruleDraft), sessionId]
    );

    return {
      sessionId,
      message: aiResponse.message,
      ruleDraft: aiResponse.ruleDraft,
      isComplete: aiResponse.isComplete,
    };
  }

  /**
   * Get AI response for conversation
   * @param {Array} conversation - Conversation history
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {Promise<Object>} AI response
   */
  async getAIResponse(conversation, mediaType) {
    try {
      const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
      const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';

      // Build conversation context
      const conversationText = conversation.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`
      ).join('\n\n');

      const systemPrompt = `You are a helpful assistant helping users create media classification rules. Your goal is to:
1. Ask clarifying questions to understand what content should go in the library
2. Be conversational and friendly
3. Ask about genres, ratings, keywords, themes, etc.
4. After 2-3 exchanges, start building a rule draft
5. Explain the rule in plain English

Available fields for rules:
- genres (array of genre names)
- keywords (array of keywords)
- certification (rating like G, PG, R, etc.)
- year (release year)
- title (title of the media)

When you have enough information, respond with:
- A friendly message explaining the rule
- A JSON rule draft in this format:
{
  "and": [
    {"field": "genres", "operator": "in", "value": ["Action", "Adventure"]},
    {"field": "certification", "operator": "in", "value": ["PG", "PG-13"]}
  ]
}

Conversation so far:
${conversationText}

Respond with a JSON object:
{
  "message": "Your conversational response",
  "ruleDraft": { "and": [...] } or null if not ready,
  "isComplete": false or true if rule is ready
}`;

      const response = await axios.post(`${ollamaHost}/api/generate`, {
        model: ollamaModel,
        prompt: systemPrompt,
        stream: false,
        options: {
          temperature: 0.7,
        },
      });

      const aiResponse = response.data.response;
      
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse AI JSON:', e);
        }
      }

      // Fallback if no JSON found - create a simple response
      return {
        message: aiResponse,
        ruleDraft: null,
        isComplete: false,
      };

    } catch (error) {
      console.error('AI response error:', error);
      
      // Fallback response
      return {
        message: "I understand. Can you tell me more about the specific genres or content types you want?",
        ruleDraft: null,
        isComplete: false,
      };
    }
  }

  /**
   * Generate final rule from conversation
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Generated rule
   */
  async generateRule(sessionId) {
    // Get session
    const sessionResult = await db.query(
      'SELECT * FROM rule_builder_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found');
    }

    const session = sessionResult.rows[0];

    if (!session.rule_draft) {
      throw new Error('Rule draft not ready. Continue the conversation to provide more details.');
    }

    // Generate rule name and description from conversation
    const conversation = session.conversation;
    const userMessages = conversation
      .filter(msg => msg.role === 'user')
      .map(msg => msg.message)
      .join(' ');

    // Simple rule name generation
    const ruleName = this.generateRuleName(userMessages, session.media_type);
    const ruleDescription = this.generateRuleDescription(session.rule_draft);

    // Save the rule
    const result = await db.query(
      `INSERT INTO library_custom_rules 
       (library_id, rule_name, rule_description, rule_logic, is_include, priority, enabled, created_by_chat, chat_transcript)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        session.library_id,
        ruleName,
        ruleDescription,
        JSON.stringify(session.rule_draft),
        true,
        10,
        true,
        true,
        JSON.stringify(conversation),
      ]
    );

    // Mark session as completed
    await db.query(
      'UPDATE rule_builder_sessions SET status = $1 WHERE session_id = $2',
      ['completed', sessionId]
    );

    return {
      rule: result.rows[0],
      message: `Great! I've created the rule "${ruleName}" for your library. The rule is now active and will be used for classification.`,
    };
  }

  /**
   * Generate a rule name from user input
   * @param {string} userInput - Combined user messages
   * @param {string} mediaType - 'movie' or 'tv'
   * @returns {string} Rule name
   */
  generateRuleName(userInput, mediaType) {
    // Simple extraction of key words
    const input = userInput.toLowerCase();
    
    const genres = ['action', 'comedy', 'drama', 'horror', 'scifi', 'fantasy', 'thriller', 'romance', 'documentary', 'animation'];
    const ratings = ['g', 'pg', 'pg-13', 'r', 'nc-17', 'tv-y', 'tv-pg', 'tv-14', 'tv-ma'];
    const themes = ['family', 'kids', 'adult', 'animated', 'anime', 'holiday', 'classic', 'modern'];

    const foundGenres = genres.filter(g => input.includes(g));
    const foundRatings = ratings.filter(r => input.includes(r));
    const foundThemes = themes.filter(t => input.includes(t));

    let name = '';
    if (foundThemes.length > 0) {
      name += foundThemes[0].charAt(0).toUpperCase() + foundThemes[0].slice(1) + ' ';
    }
    if (foundGenres.length > 0) {
      name += foundGenres[0].charAt(0).toUpperCase() + foundGenres[0].slice(1) + ' ';
    }
    if (foundRatings.length > 0) {
      name += foundRatings[0].toUpperCase() + ' ';
    }
    
    name += mediaType === 'movie' ? 'Movies' : 'Shows';

    return name.trim() || `Custom ${mediaType === 'movie' ? 'Movie' : 'TV'} Rule`;
  }

  /**
   * Generate a human-readable description from rule logic
   * @param {Object} ruleLogic - Rule logic object
   * @returns {string} Description
   */
  generateRuleDescription(ruleLogic) {
    const parts = [];

    const processConditions = (conditions, connector) => {
      return conditions.map(cond => {
        if (cond.field === 'genres' && cond.operator === 'in') {
          return `genres include ${cond.value.join(' or ')}`;
        }
        if (cond.field === 'keywords' && cond.operator === 'contains') {
          return `keywords contain ${cond.value}`;
        }
        if (cond.field === 'certification' && cond.operator === 'in') {
          return `rating is ${cond.value.join(' or ')}`;
        }
        if (cond.field === 'year' && cond.operator === 'greaterThan') {
          return `released after ${cond.value}`;
        }
        if (cond.field === 'year' && cond.operator === 'lessThan') {
          return `released before ${cond.value}`;
        }
        return `${cond.field} ${cond.operator} ${cond.value}`;
      }).join(` ${connector} `);
    };

    if (ruleLogic.and) {
      parts.push(processConditions(ruleLogic.and, 'AND'));
    } else if (ruleLogic.or) {
      parts.push(processConditions(ruleLogic.or, 'OR'));
    } else if (ruleLogic.field) {
      parts.push(processConditions([ruleLogic], ''));
    }

    return parts.join('. ') || 'Custom classification rule';
  }

  /**
   * Test rule against sample data
   * @param {Object} rule - Rule logic
   * @param {Object} testData - Sample media data
   * @returns {Promise<Object>} Test result
   */
  async validateRule(rule, testData) {
    try {
      // Import classification service for evaluation
      const classificationService = require('./classification');
      
      const matches = await classificationService.evaluateCustomRule(
        { rule_logic: rule },
        testData
      );

      return {
        matches,
        explanation: matches 
          ? 'This media would match the rule and be classified to this library'
          : 'This media would NOT match the rule',
        testData,
      };
    } catch (error) {
      console.error('Rule validation error:', error);
      return {
        matches: false,
        explanation: 'Error validating rule: ' + error.message,
        testData,
      };
    }
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session data
   */
  async getSession(sessionId) {
    const result = await db.query(
      'SELECT * FROM rule_builder_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Session not found');
    }

    return result.rows[0];
  }
}

module.exports = new RuleBuilderService();
