/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
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
const os = require('os');
const db = require('../config/database');
const { createLogger } = require('../utils/logger');
const { OperationController } = require('../utils/operationController');

const logger = createLogger('OllamaService');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.model = null;
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

    this.preflightCache = new Map();

    this.scheduledPreflightTimer = null;
    this.lastScheduledPreflight = null;
    this.lastEmbeddingPreflight = null;
  }

  startScheduledPreflight(intervalMs = 24 * 60 * 60 * 1000) {
    if (this.scheduledPreflightTimer) {
      return;
    }

    this.scheduledPreflightTimer = setInterval(async () => {
      try {
        const config = await this.getConfig();
        if (!config.host) {
          return;
        }

        const db = require('../config/database');
        let embeddingModel = null;
        try {
          const embedResult = await db.query('SELECT embedding_model, embedding_ollama_model FROM ai_provider_config WHERE id = 1');
          const row = embedResult.rows[0];
          embeddingModel = row?.embedding_model || row?.embedding_ollama_model || null;
        } catch {}

        const result = await this.preflightConnection({
          host: config.host,
          port: config.port,
          model: config.model,
          probeGeneration: true,
          force: true,
          includeModels: true
        });

        this.lastScheduledPreflight = {
          ...result,
          checkedAt: new Date().toISOString()
        };

        if (result.success) {
          logger.info('Scheduled Ollama preflight passed', {
            host: result.host,
            port: result.port,
            model: config.model,
            modelCount: result.models?.length || 0,
            latencyMs: result.latency_ms
          });

          if (embeddingModel && embeddingModel !== config.model) {
            const embedResult = await this.preflightConnection({
              host: config.host,
              port: config.port,
              model: embeddingModel,
              probeGeneration: false,
              force: true,
              includeModels: false
            });
            this.lastEmbeddingPreflight = {
              ...embedResult,
              checkedAt: new Date().toISOString()
            };
            logger.info('Scheduled Ollama embedding model preflight passed', {
              model: embeddingModel,
              available: embedResult.success
            });
          }
        } else {
          logger.warn('Scheduled Ollama preflight failed', {
            host: result.host,
            port: result.port,
            model: config.model,
            error: result.error,
            errorCode: result.errorCode
          });
        }
      } catch (error) {
        logger.error('Scheduled Ollama preflight error', { error: error.message });
      }
    }, intervalMs);

    logger.info('Scheduled Ollama preflight check started', {
      intervalHours: intervalMs / (60 * 60 * 1000)
    });
  }

  stopScheduledPreflight() {
    if (this.scheduledPreflightTimer) {
      clearInterval(this.scheduledPreflightTimer);
      this.scheduledPreflightTimer = null;
      logger.info('Scheduled Ollama preflight check stopped');
    }
  }

  getLastScheduledPreflight() {
    return {
      ai: this.lastScheduledPreflight,
      embedding: this.lastEmbeddingPreflight
    };
  }

  async warmModel(model, keepAlive = '24h', host = null, port = null) {
    const config = await this.getConfig();
    const warmHost = host || config.host;
    const warmPort = port || config.port;
    const warmUrl = `http://${warmHost}:${warmPort}`;

    if (!warmHost) {
      throw new Error('Ollama host not configured');
    }

    const startedAt = Date.now();
    try {
      await axios.post(
        `${warmUrl}/api/generate`,
        {
          model,
          prompt: '',
          keep_alive: keepAlive
        },
        { timeout: 60000 }
      );

      return {
        success: true,
        model,
        host: warmHost,
        port: warmPort,
        latency_ms: Date.now() - startedAt,
        keep_alive: keepAlive,
        message: `Model '${model}' loaded and will stay in memory for ${keepAlive}`
      };
    } catch (error) {
      if (error.message && error.message.includes('does not support generate')) {
        return this.warmEmbeddingModel(model, keepAlive, warmHost, warmPort);
      }
      return {
        success: false,
        model,
        host: warmHost,
        port: warmPort,
        error: error.message,
        errorCode: error.code || 'EWARM',
        message: `Failed to warm model '${model}': ${error.message}`
      };
    }
  }

  async warmEmbeddingModel(model, keepAlive = '24h', host = null, port = null) {
    const config = await this.getConfig();
    const warmHost = host || config.host;
    const warmPort = port || config.port;
    const warmUrl = `http://${warmHost}:${warmPort}`;

    if (!warmHost) {
      return {
        success: false,
        model,
        error: 'Ollama host not configured',
        message: 'Ollama host not configured'
      };
    }

    const startedAt = Date.now();
    try {
      await axios.post(
        `${warmUrl}/api/embed`,
        {
          model,
          input: 'warmup',
          keep_alive: keepAlive
        },
        { timeout: 60000 }
      );

      return {
        success: true,
        model,
        host: warmHost,
        port: warmPort,
        latency_ms: Date.now() - startedAt,
        keep_alive: keepAlive,
        message: `Embedding model '${model}' loaded and will stay in memory for ${keepAlive}`
      };
    } catch (error) {
      return {
        success: false,
        model,
        host: warmHost,
        port: warmPort,
        error: error.message,
        errorCode: error.code || 'EWARM',
        message: `Failed to warm embedding model '${model}': ${error.message}`
      };
    }
  }

  async warmAllModels(keepAlive = '24h') {
    const config = await this.getConfig();
    const results = {
      ai: null,
      embedding: null
    };

    if (config.model) {
      results.ai = await this.warmModel(config.model, keepAlive, config.host, config.port);
    }

    const db = require('../config/database');
    try {
      const embedResult = await db.query('SELECT embedding_model, embedding_ollama_model, embedding_provider FROM ai_provider_config WHERE id = 1');
      const row = embedResult.rows[0];
      const embeddingModel = row?.embedding_model || row?.embedding_ollama_model || null;
      if (embeddingModel && embeddingModel !== config.model) {
        results.embedding = await this.warmEmbeddingModel(embeddingModel, keepAlive, config.host, config.port);
      }
    } catch {}

    return results;
  }

  resetConfig() {
    this.host = null;
    this.port = null;
    this.model = null;
    this.baseUrl = null;
    this.preflightCache.clear();
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
    // Use cached config if available (performance optimization)
    // Cache is invalidated via resetConfig() when settings are updated
    if (this.baseUrl) {
      return { host: this.host, port: this.port, baseUrl: this.baseUrl, model: this.model };
    }

    // Try to load from ollama_config table first
    const result = await db.query('SELECT id, host, port, model FROM ollama_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
      this.model = result.rows[0].model;
    } else {
      // Try ai_provider_config as fallback (unified settings)
      const aiResult = await db.query('SELECT ollama_host, ollama_port, ollama_model FROM ai_provider_config WHERE id = 1');
      if (aiResult.rows.length > 0 && aiResult.rows[0].ollama_host) {
        this.host = aiResult.rows[0].ollama_host;
        this.port = aiResult.rows[0].ollama_port || 11434;
        this.model = aiResult.rows[0].ollama_model;
      } else {
        // Fall back to environment variables or default
        this.host = process.env.OLLAMA_HOST || 'localhost';
        this.port = process.env.OLLAMA_PORT || 11434;
        this.model = null;
      }
    }

    this.baseUrl = `http://${this.host}:${this.port}`;
    return { host: this.host, port: this.port, baseUrl: this.baseUrl, model: this.model };
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

  parseCacheMs(cacheMs, fallback = 60000) {
    const parsed = Number.parseInt(String(cacheMs ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  normalizeModelName(modelName) {
    return typeof modelName === 'string' ? modelName.trim() : '';
  }

  findModelMatch(models, modelName) {
    const normalizedModel = this.normalizeModelName(modelName).toLowerCase();
    if (!normalizedModel || !Array.isArray(models)) {
      return null;
    }

    return models.find((model) => {
      const currentName = String(model?.name || '').toLowerCase();
      if (!currentName) {
        return false;
      }
      return (
        currentName === normalizedModel ||
        currentName.startsWith(`${normalizedModel}:`) ||
        normalizedModel.startsWith(`${currentName}:`) ||
        currentName.split(':')[0] === normalizedModel.split(':')[0]
      );
    }) || null;
  }

  buildPreflightCacheKey({ host, port, model, probeGeneration }) {
    return `${host}:${port}:${this.normalizeModelName(model).toLowerCase()}:${probeGeneration ? 'probe' : 'noprobe'}`;
  }

  async probeGeneration(host, port, model) {
    const testUrl = `http://${host}:${port}`;
    const startedAt = Date.now();

    await axios.post(
      `${testUrl}/api/generate`,
      {
        model,
        prompt: 'Reply with OK only.',
        stream: false,
        options: {
          temperature: 0,
          num_predict: 4,
        },
      },
      {
        timeout: 15000,
      }
    );

    return {
      ok: true,
      latency_ms: Date.now() - startedAt,
    };
  }

  async preflightConnection(options = {}) {
    const {
      host = null,
      port = null,
      model = null,
      probeGeneration = false,
      force = false,
      includeModels = true,
      cacheMs = process.env.OLLAMA_PREFLIGHT_CACHE_MS
    } = options || {};

    const config = await this.getConfig();
    const testHost = host || config.host;
    const testPort = Number(port || config.port || 11434);
    const modelName = this.normalizeModelName(model);
    const resolvedCacheMs = this.parseCacheMs(cacheMs, 60000);
    const cacheKey = this.buildPreflightCacheKey({
      host: testHost,
      port: testPort,
      model: modelName,
      probeGeneration
    });

    if (!force && resolvedCacheMs > 0) {
      const cached = this.preflightCache.get(cacheKey);
      if (cached && (Date.now() - cached.checkedAt) < resolvedCacheMs) {
        return {
          ...cached.result,
          cached: true
        };
      }
    }

    const startedAt = Date.now();
    const connection = await this.testConnection(testHost, testPort);
    const result = {
      success: false,
      host: testHost,
      port: testPort,
      model: modelName || null,
      checked_at: new Date().toISOString(),
      cached: false,
      checks: {
        connectivity: {
          ok: !!connection.success,
          error: connection.error || null,
          errorCode: connection.errorCode || null
        },
        model_available: {
          ok: modelName ? null : true,
          value: modelName ? null : true
        },
        generation_probe: {
          ok: probeGeneration ? null : false,
          skipped: !probeGeneration
        }
      },
      message: '',
      error: null,
      errorCode: null
    };

    if (!connection.success) {
      result.error = connection.error || 'Connection failed';
      result.errorCode = connection.errorCode || 'EOLLAMA_CONNECT';
      result.message = result.error;
      this.preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
      return result;
    }

    const models = Array.isArray(connection.models) ? connection.models : [];
    const modelMatch = modelName ? this.findModelMatch(models, modelName) : null;

    if (modelName && !modelMatch) {
      result.error = `Model '${modelName}' is not available on ${testHost}:${testPort}`;
      result.errorCode = 'MODEL_NOT_FOUND';
      result.message = result.error;
      result.checks.model_available = {
        ok: false,
        value: false
      };
      if (includeModels) {
        result.models = models;
      }
      this.preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
      return result;
    }

    result.checks.model_available = {
      ok: true,
      value: true
    };

    if (probeGeneration && modelName) {
      try {
        const probe = await this.probeGeneration(testHost, testPort, modelName);
        result.checks.generation_probe = {
          ok: true,
          skipped: false,
          latency_ms: probe.latency_ms
        };
      } catch (error) {
        result.error = `Connected, but generation probe failed: ${error.message}`;
        result.errorCode = error.code || 'EGEN_PROBE';
        result.message = result.error;
        result.checks.generation_probe = {
          ok: false,
          skipped: false,
          error: error.message,
          errorCode: error.code || null
        };
        if (includeModels) {
          result.models = models;
        }
        this.preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
        return result;
      }
    }

    result.success = true;
    result.message = probeGeneration && modelName
      ? `Connection successful - model '${modelName}' is ready`
      : 'Connection successful';
    result.latency_ms = Date.now() - startedAt;
    result.model_available = modelName ? true : null;
    if (includeModels) {
      result.models = models;
    }

    this.preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
    return result;
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

  /**
   * Get currently loaded models in Ollama memory
   * Uses /api/ps endpoint to check running models
   * @param {string} host - Optional host override
   * @param {number} port - Optional port override
   * @returns {Promise<Array>} List of loaded models with name, size, digest
   */
  async getLoadedModels(host = null, port = null) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/ps`, {
        timeout: 5000
      });
      return response.data.models || [];
    } catch (error) {
      // If endpoint doesn't exist or fails, return empty array (non-fatal)
      logger.warn('Failed to get loaded models', { error: error.message });
      return [];
    }
  }


  /**
   * Check if a specific model is currently loaded in Ollama memory
   * @param {string} modelName - Model name to check (with or without tag)
   * @param {string} host - Optional host override
   * @param {number} port - Optional port override
   * @returns {Promise<boolean>} True if model is loaded
   */
  async isModelLoaded(modelName, host = null, port = null) {
    const loadedModels = await this.getLoadedModels(host, port);
    // Check for exact match or match with tag suffix (e.g., 'gemma3:12b' matches 'gemma3:12b')
    return loadedModels.some(m =>
      m.name === modelName ||
      m.name.startsWith(modelName + ':') ||
      modelName.startsWith(m.name.split(':')[0])
    );
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
   * Generate embeddings for text
   * @param {string} text - Text to embed
   * @param {string} model - Embedding model name (default: nomic-embed-text-v2-moe)
   * @param {string} keepAlive - Duration to keep model loaded (default: '5m')
   * @returns {Promise<{embedding: number[], dims: number}>} Embedding vector and dimensions
   */
  async embed(text, model = 'nomic-embed-text-v2-moe', keepAlive = '5m', signal = null) {
    try {
      const config = await this.getConfig();

      // Ensure model is available
      const models = await this.getModels();
      const modelExists = models.some(m => m.name === model || m.name.startsWith(model));

      if (!modelExists) {
        console.log(`[Ollama] Embedding model ${model} not found, attempting to pull...`);
        await this.pullModel(model, signal);
      }

      const response = await axios.post(`${config.baseUrl}/api/embed`, {
        model,
        input: text,
        keep_alive: keepAlive,
      }, {
        timeout: 300000,
        signal: signal
      });

      const embedding = response.data.embeddings?.[0] || response.data.embedding;
      return {
        embedding: embedding,
        dims: embedding.length
      };
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw error;
      }
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async pullModel(model, signal = null) {
    try {
      const config = await this.getConfig();
      console.log(`[Ollama] Pulling model: ${model}`);

      const response = await axios.post(`${config.baseUrl}/api/pull`, {
        name: model,
        stream: false,
      }, {
        timeout: 300000,
        signal: signal
      });

      console.log(`[Ollama] Model ${model} pulled successfully`);
      return true;
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw error;
      }
      console.error(`[Ollama] Failed to pull model ${model}: ${error.message}`);
      throw new Error(`Failed to pull model ${model}: ${error.message}`);
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
  async generateWithProgress(
    prompt,
    model = 'qwen3:14b',
    temperature = 0.30,
    onProgress = null,
    externalController = null,
    options = {}
  ) {
    const config = await this.getConfig();
    const generateOptions = {
      allowPartialOnStall: options.allowPartialOnStall !== false,
      allowPartialOnAbort: options.allowPartialOnAbort !== false,
      requireDoneSignal: options.requireDoneSignal === true
    };
    
    if (externalController) {
      return this._streamGenerate(config, prompt, model, temperature, onProgress, externalController, generateOptions);
    }
    
    const controller = new OperationController({ 
      mode: 'streaming',
      initialTimeout: 120000,
      heartbeatTimeout: 60000,
      hardTimeout: 300000,
      allowPartialOnStall: generateOptions.allowPartialOnStall
    });
    
    return controller.runStreaming(
      (signal, ctrl) => this._streamGenerate(config, prompt, model, temperature, onProgress, ctrl, generateOptions),
      'ollama_generate'
    );
  }

  async _streamGenerate(config, prompt, model, temperature, onProgress, controller, options = {}) {
    const preflight = await this.preflightConnection({
      host: config.host,
      port: config.port,
      model: model,
      probeGeneration: false,
      cacheMs: 60000
    });

    if (!preflight.success) {
      throw new Error(preflight.error || 'Ollama connection failed');
    }

    return new Promise((resolve, reject) => {
      let fullResponse = '';
      let tokenCount = 0;
      let resolved = false;
      let sawDoneSignal = false;

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
          controller.recordActivity();
          
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
              const json = JSON.parse(line);
              if (json.response) {
                fullResponse += json.response;
                tokenCount++;
                controller.recordActivity(fullResponse);
                if (onProgress) {
                  onProgress(tokenCount, false);
                }
              }
              if (json.done && !resolved) {
                sawDoneSignal = true;
                resolved = true;
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
            reject(new Error(`Stream error: ${err.message}`));
          }
        });

        response.data.on('end', () => {
          if (!resolved) {
            resolved = true;
            if (fullResponse && (!options.requireDoneSignal || sawDoneSignal)) {
              if (onProgress) onProgress(tokenCount, true);
              resolve(fullResponse);
            } else if (fullResponse && options.requireDoneSignal && !sawDoneSignal) {
              const incompleteError = new Error('Generation ended before completion signal');
              incompleteError.name = 'IncompleteStreamError';
              incompleteError.code = 'EINCOMPLETE';
              incompleteError.partialResponse = fullResponse;
              reject(incompleteError);
            } else {
              reject(new Error('Empty response from model'));
            }
          }
        });
      }).catch(err => {
        if (!resolved) {
          resolved = true;
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.code === 'ABORT_ERR') {
            if (controller.partialResult && options.allowPartialOnAbort) {
              resolve(controller.partialResult);
            } else {
              const abortError = new Error(
                controller.partialResult
                  ? 'Generation aborted with partial response blocked'
                  : 'Generation aborted'
              );
              abortError.name = 'AbortError';
              abortError.code = 'ABORT_ERR';
              if (controller.partialResult) {
                abortError.partialResponse = controller.partialResult;
              }
              reject(abortError);
            }
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
