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
const logger = require('../utils/logger');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.baseUrl = null;
    this.detectedGateway = null;

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
   * Get default Ollama host
   * @returns {string} Default host (localhost)
   */
  getDefaultOllamaHost() {
    return 'localhost';
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
    const result = await db.query('SELECT id, host, port FROM ollama_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
    } else {
      // Fall back to environment variables or default
      this.host = process.env.OLLAMA_HOST || 'localhost';
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
      let errorMessage = error.message;

      // Provide helpful error messages based on error type
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - is Ollama running?';
      } else if (error.code === 'ENOTFOUND') {
        if (testHost === 'host.docker.internal' && os.platform() === 'linux') {
          const detectedGateway = this.getDefaultOllamaHost();
          errorMessage = `Cannot resolve hostname '${testHost}'. This hostname is not available on Linux. Try using the detected gateway IP: ${detectedGateway}, or use your Ollama container name if on the same Docker network.`;
        } else {
          errorMessage = `Cannot resolve hostname '${testHost}'. Check that the hostname or IP address is correct.`;
        }
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = `Connection timed out. Verify the host (${testHost}) is reachable and port ${testPort} is accessible.`;
      } else if (error.code === 'EHOSTUNREACH') {
        errorMessage = `Host unreachable. Check network connectivity to ${testHost}.`;
      }

      return {
        success: false,
        error: errorMessage,
        errorCode: error.code
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
    const HEARTBEAT_TIMEOUT_MS = 60000; // Solution D: 60 second inactivity timeout
    const HARD_TIMEOUT_MS = 180000;     // Solution C: 3 minute absolute timeout

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let tokenCount = 0;
      let lastChunkTime = Date.now();
      let resolved = false; // Prevent double resolution

      const controller = new AbortController();

      // Solution C: Hard 3-minute absolute timeout
      const hardTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          controller.abort();
          reject(new Error('Generation timeout - no response after 3 minutes'));
        }
      }, HARD_TIMEOUT_MS);

      // Solution D: Heartbeat watchdog - check every 10 seconds for 60s inactivity
      const heartbeatCheck = setInterval(() => {
        const timeSinceLastChunk = Date.now() - lastChunkTime;
        if (timeSinceLastChunk > HEARTBEAT_TIMEOUT_MS && !resolved) {
          resolved = true;
          clearTimeout(hardTimeout);
          clearInterval(heartbeatCheck);
          controller.abort();
          if (fullResponse) {
            // We have partial data, consider it a success
            if (onProgress) onProgress(tokenCount, true);
            resolve(fullResponse);
          } else {
            reject(new Error('Generation stalled - no data received for 60 seconds'));
          }
        }
      }, 10000);

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
          lastChunkTime = Date.now(); // Reset heartbeat timer
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
              if (json.done && !resolved) {
                resolved = true;
                clearTimeout(hardTimeout);
                clearInterval(heartbeatCheck);
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
          if (!resolved) {
            resolved = true;
            clearTimeout(hardTimeout);
            clearInterval(heartbeatCheck);
            reject(new Error(`Stream error: ${err.message}`));
          }
        });

        response.data.on('end', () => {
          clearTimeout(hardTimeout);
          clearInterval(heartbeatCheck);
          if (!resolved) {
            resolved = true;
            if (fullResponse) {
              // Stream ended with data but no 'done' signal - treat as success
              if (onProgress) onProgress(tokenCount, true);
              resolve(fullResponse);
            } else {
              reject(new Error('Empty response from model'));
            }
          }
        });
      }).catch(err => {
        if (!resolved) {
          resolved = true;
          clearTimeout(hardTimeout);
          clearInterval(heartbeatCheck);
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
            reject(new Error('Generation aborted due to timeout'));
          } else {
            reject(new Error(`Failed to generate: ${err.message}`));
          }
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
        name: 'phi3:3.8b',
        displayName: 'Phi-3 3.8B',
        size: '3.8B',
        vram: '4GB',
        speed: 'Fastest',
        accuracy: 'Good',
        description: 'Best for low-end GPUs (4GB VRAM)',
        recommended: false,
      },
      {
        name: 'mistral:7b',
        displayName: 'Mistral 7B',
        size: '7B',
        vram: '6GB',
        speed: 'Very Fast',
        accuracy: 'Good',
        description: 'Popular, well-tested (6GB VRAM)',
        recommended: false,
      },
      {
        name: 'gemma3:4b',
        displayName: 'Gemma 3 4B',
        size: '4B',
        vram: '8GB',
        speed: 'Very Fast',
        accuracy: 'High',
        description: 'Best balance of speed/accuracy (8GB VRAM)',
        recommended: true,
      },
      {
        name: 'gemma3:12b',
        displayName: 'Gemma 3 12B',
        size: '12B',
        vram: '12GB',
        speed: 'Fast',
        accuracy: 'Very High',
        description: 'Excellent for 12GB+ cards',
        recommended: true,
      },
      {
        name: 'qwen3:8b',
        displayName: 'Qwen 3 8B',
        size: '8B',
        vram: '12GB',
        speed: 'Fast',
        accuracy: 'High',
        description: 'Strong multilingual support',
        recommended: false,
      },
      {
        name: 'deepseek-r1:8b',
        displayName: 'DeepSeek R1 8B',
        size: '8B',
        vram: '16GB',
        speed: 'Fast',
        accuracy: 'Very High',
        description: 'Strong reasoning capabilities',
        recommended: false,
      },
      {
        name: 'qwen3:14b',
        displayName: 'Qwen 3 14B',
        size: '14B',
        vram: '16GB',
        speed: 'Medium',
        accuracy: 'Very High',
        description: 'Default model, excellent accuracy',
        recommended: false,
      },
      {
        name: 'gemma3:27b',
        displayName: 'Gemma 3 27B',
        size: '27B',
        vram: '24GB',
        speed: 'Medium',
        accuracy: 'Highest',
        description: 'Best accuracy for high-end GPUs',
        recommended: false,
      },
    ];
  }
}

module.exports = new OllamaService();
