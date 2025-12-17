const axios = require('axios');
const { query } = require('../config/database');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.model = null;
    this.baseUrl = null;
  }

  async initialize() {
    const result = await query('SELECT host, port, model FROM ollama_config WHERE enabled = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
      this.model = result.rows[0].model;
    } else {
      this.host = process.env.OLLAMA_HOST || 'localhost';
      this.port = process.env.OLLAMA_PORT || 11434;
      this.model = process.env.OLLAMA_MODEL || 'llama2';
    }
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  async generate(prompt, options = {}) {
    if (!this.baseUrl) await this.initialize();

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          ...options
        }
      }, {
        timeout: 60000
      });

      return response.data.response;
    } catch (err) {
      console.error('Ollama API error:', err.message);
      throw err;
    }
  }

  async chat(messages, options = {}) {
    if (!this.baseUrl) await this.initialize();

    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          ...options
        }
      }, {
        timeout: 60000
      });

      return response.data.message.content;
    } catch (err) {
      console.error('Ollama chat API error:', err.message);
      throw err;
    }
  }

  async classifyMedia(metadata, libraries) {
    const prompt = this.buildClassificationPrompt(metadata, libraries);
    const response = await this.generate(prompt, { temperature: 0.3 });
    return this.parseClassificationResponse(response, libraries);
  }

  buildClassificationPrompt(metadata, libraries) {
    const libraryDescriptions = libraries.map((lib, idx) => 
      `${idx + 1}. ${lib.name} (${lib.media_type}): Labels: ${lib.labels?.join(', ') || 'None'}`
    ).join('\n');

    return `You are a media classification expert. Analyze the following movie/TV show and determine which library it best fits into.

Media Information:
- Title: ${metadata.title}
- Year: ${metadata.year}
- Type: ${metadata.mediaType}
- Genres: ${metadata.genres?.join(', ')}
- Rating: ${metadata.rating}
- Overview: ${metadata.overview?.substring(0, 200)}...
${metadata.keywords ? `- Keywords: ${metadata.keywords.slice(0, 10).join(', ')}` : ''}

Available Libraries:
${libraryDescriptions}

Instructions:
1. Analyze the media's content, rating, genres, and characteristics
2. Match it to the BEST fitting library based on the library labels and media type
3. Provide a confidence score (0-100)
4. Explain your reasoning in 1-2 sentences

Response format (JSON only):
{
  "libraryIndex": <number 1-${libraries.length}>,
  "confidence": <number 0-100>,
  "reason": "<explanation>"
}`;
  }

  parseClassificationResponse(response, libraries) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const libraryIndex = parsed.libraryIndex - 1; // Convert to 0-based

      if (libraryIndex < 0 || libraryIndex >= libraries.length) {
        throw new Error('Invalid library index');
      }

      return {
        library: libraries[libraryIndex],
        confidence: Math.min(100, Math.max(0, parsed.confidence)),
        reason: parsed.reason || 'AI classification'
      };
    } catch (err) {
      console.error('Failed to parse Ollama response:', err.message);
      // Fallback to first library with low confidence
      return {
        library: libraries[0],
        confidence: 30,
        reason: 'Fallback classification (parsing failed)'
      };
    }
  }
}

module.exports = new OllamaService();
