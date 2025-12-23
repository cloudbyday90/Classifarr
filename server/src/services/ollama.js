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

const axios = require('axios');
const db = require('../config/database');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.baseUrl = null;

    // Generation status tracking for UI
    this.currentGeneration = {
      isActive: false,
      model: null,
      tokenCount: 0,
      startTime: null,
      itemTitle: null,
    };
  }

  resetConfig() {
    this.host = null;
    this.port = null;
    this.baseUrl = null;
  }

  /**
   * Get current generation status for UI
   */
  getGenerationStatus() {
    if (!this.currentGeneration.isActive) {
      return { isActive: false };
    }

    const elapsed = Date.now() - this.currentGeneration.startTime;
    return {
      isActive: true,
      model: this.currentGeneration.model,
      tokenCount: this.currentGeneration.tokenCount,
      elapsedSeconds: Math.round(elapsed / 1000),
      itemTitle: this.currentGeneration.itemTitle,
    };
  }

  /**
   * Set generation status (called from classification service)
   */
  setGenerationStatus(isActive, model = null, itemTitle = null) {
    if (isActive) {
      this.currentGeneration = {
        isActive: true,
        model,
        tokenCount: 0,
        startTime: Date.now(),
        itemTitle,
      };
    } else {
      this.currentGeneration = {
        isActive: false,
        model: null,
        tokenCount: 0,
        startTime: null,
        itemTitle: null,
      };
    }
  }

  /**
   * Update token count during generation
   */
  updateTokenCount(count) {
    this.currentGeneration.tokenCount = count;
  }

  async getConfig() {
    if (this.baseUrl) {
      return { host: this.host, port: this.port, baseUrl: this.baseUrl };
    }

    // Try to load from database
    const result = await db.query('SELECT host, port FROM ollama_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
    } else {
      // Fall back to environment variables
      this.host = process.env.OLLAMA_HOST || 'host.docker.internal';
      this.port = process.env.OLLAMA_PORT || 11434;
    }

    this.baseUrl = `http://${this.host}:${this.port}`;
    return { host: this.host, port: this.port, baseUrl: this.baseUrl };
  }

  async testConnection(host = null, port = null) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/tags`, {
        timeout: 5000,
      });

      return {
        success: true,
        models: response.data.models,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.code === 'ECONNREFUSED'
          ? 'Connection refused - is Ollama running?'
          : error.message
      };
    }
  }

  async getModels(host = null, port = null) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Failed to fetch models: ${error.message}`);
    }
  }

  async generate(prompt, model = 'qwen3:14b', temperature = 0.30) {
    try {
      const config = await this.getConfig();
      const response = await axios.post(`${config.baseUrl}/api/generate`, {
        model,
        prompt,
        temperature,
        stream: false,
      }, {
        timeout: 120000, // 2 minute timeout for non-streaming
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Generate response with streaming and progress tracking
   * @param {string} prompt - The prompt to send
   * @param {string} model - Model name
   * @param {number} temperature - Temperature setting
   * @param {function} onProgress - Callback for progress updates (tokenCount, isComplete)
   * @returns {Promise<string>} - Complete response text
   */
  async generateWithProgress(prompt, model = 'qwen3:14b', temperature = 0.30, onProgress = null) {
    const config = await this.getConfig();

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let tokenCount = 0;
      let lastHeartbeat = Date.now();

      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Generation timeout - no response after 3 minutes'));
      }, 180000); // 3 minute absolute timeout

      axios.post(`${config.baseUrl}/api/generate`, {
        model,
        prompt,
        temperature,
        stream: true,
      }, {
        responseType: 'stream',
        signal: controller.signal,
      }).then(response => {
        response.data.on('data', (chunk) => {
          lastHeartbeat = Date.now();
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
              const json = JSON.parse(line);
              if (json.response) {
                fullResponse += json.response;
                tokenCount++;
                if (onProgress) {
                  onProgress(tokenCount, false);
                }
              }
              if (json.done) {
                clearTimeout(timeout);
                if (onProgress) {
                  onProgress(tokenCount, true);
                }
                resolve(fullResponse);
              }
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        });

        response.data.on('error', (err) => {
          clearTimeout(timeout);
          reject(new Error(`Stream error: ${err.message}`));
        });

        response.data.on('end', () => {
          clearTimeout(timeout);
          if (!fullResponse) {
            reject(new Error('Empty response from model'));
          }
        });
      }).catch(err => {
        clearTimeout(timeout);
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
          reject(new Error('Generation aborted due to timeout'));
        } else {
          reject(new Error(`Failed to generate: ${err.message}`));
        }
      });
    });
  }

  /**
   * Get recommended models for classification tasks
   * @returns {Array} List of recommended models with metadata
   */
  getRecommendedModels() {
    return [
      {
        name: 'llama3.3:8b',
        displayName: 'Llama 3.3 8B',
        size: '8B',
        speed: 'Fast',
        accuracy: 'High',
        description: 'Best balance of speed and accuracy for classification',
        recommended: true,
      },
      {
        name: 'gemma2:9b',
        displayName: 'Gemma 2 9B',
        size: '9B',
        speed: 'Fast',
        accuracy: 'High',
        description: 'Google\'s efficient model, great for edge deployment',
        recommended: true,
      },
      {
        name: 'mistral:7b',
        displayName: 'Mistral 7B',
        size: '7B',
        speed: 'Very Fast',
        accuracy: 'Good',
        description: 'Fastest option with good accuracy',
        recommended: false,
      },
      {
        name: 'phi3:14b',
        displayName: 'Phi-3 14B',
        size: '14B',
        speed: 'Medium',
        accuracy: 'High',
        description: 'Microsoft\'s efficient model for complex tasks',
        recommended: false,
      },
      {
        name: 'qwen3:14b',
        displayName: 'Qwen 3 14B',
        size: '14B',
        speed: 'Medium',
        accuracy: 'Very High',
        description: 'Excellent multilingual support, current default',
        recommended: false,
      },
      {
        name: 'deepseek-r1:8b',
        displayName: 'DeepSeek R1 8B',
        size: '8B',
        speed: 'Fast',
        accuracy: 'Very High',
        description: 'Strong reasoning capabilities',
        recommended: false,
      },
    ];
  }
}

module.exports = new OllamaService();
