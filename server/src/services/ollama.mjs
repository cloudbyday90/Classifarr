/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { warmModel, warmEmbeddingModel, warmAllModels } from './ollamaModelWarming.mjs';
import { getRecommendedModels } from './ollamaRecommendedModels.mjs';
import {
  MIN_TIMEOUT_MS,
  DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS,
  parseDurationMs,
  parseCacheMs,
} from './ollamaPreflightUtils.mjs';
import {
  testConnection as _testConnection,
  preflightConnection as _preflightConnection,
  probeGeneration as _probeGeneration,
  getModels as _getModels,
  getLoadedModels as _getLoadedModels,
  isModelLoaded as _isModelLoaded,
} from './ollamaConnection.mjs';
import {
  generate as _generate,
  generateWithProgress as _generateWithProgress,
  streamGenerate as _streamGenerate,
  embed as _embed,
  pullModel as _pullModel,
} from './ollamaGeneration.mjs';
import { runScheduledPreflight as _runScheduledPreflight } from './ollamaScheduledPreflight.mjs';

const logger = createLogger('OllamaService');

class OllamaService {
  constructor() {
    this.host = null;
    this.port = null;
    this.model = null;
    this.baseUrl = null;
    this.detectedGateway = null;

    this.currentGeneration = {
      isActive: false,
      model: null,
      tokenCount: 0,
      startTime: null,
      itemTitle: null,
    };

    this.preflightCache = new Map();

    this.scheduledPreflightTimer = null;
    this.scheduledPreflightEnabled = false;
    this.scheduledPreflightInFlight = false;
    this.scheduledPreflightBaseIntervalMs = DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS;
    this.scheduledPreflightFailureCount = 0;
    this.lastScheduledPreflight = null;
    this.lastEmbeddingPreflight = null;
  }

  startScheduledPreflight(intervalMs = DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS) {
    if (this.scheduledPreflightTimer || this.scheduledPreflightInFlight) {
      return;
    }

    this.scheduledPreflightEnabled = true;
    this.scheduledPreflightFailureCount = 0;
    this.scheduledPreflightBaseIntervalMs = parseDurationMs(
      intervalMs,
      DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS,
      MIN_TIMEOUT_MS,
    );

    const nextRun = this.scheduleNextScheduledPreflight(
      this.scheduledPreflightBaseIntervalMs,
      'scheduled',
    );

    logger.info('Scheduled Ollama preflight check started', {
      intervalHours: this.scheduledPreflightBaseIntervalMs / (60 * 60 * 1000),
      nextScheduledAt: nextRun.nextScheduledAt,
    });
  }

  async runScheduledPreflight(trigger = 'scheduled') {
    if (!this.scheduledPreflightEnabled) {
      return null;
    }

    if (this.scheduledPreflightInFlight) {
      logger.debug('Scheduled Ollama preflight skipped because a previous run is still in flight');
      return this.lastScheduledPreflight;
    }

    this.scheduledPreflightInFlight = true;

    try {
      const result = await _runScheduledPreflight(
        {
          enabled: this.scheduledPreflightEnabled,
          baseIntervalMs: this.scheduledPreflightBaseIntervalMs,
          failureCount: this.scheduledPreflightFailureCount,
        },
        {
          getConfig: () => this.getConfig(),
          preflightConnection: (opts) => this.preflightConnection(opts),
          scheduleNext: (delayMs, triggerType) => this.scheduleNextScheduledPreflight(delayMs, triggerType),
        },
        trigger,
      );

      if (result) {
        this.scheduledPreflightFailureCount = result.failureCount;
        if (result.lastScheduledPreflight !== null) {
          this.lastScheduledPreflight = result.lastScheduledPreflight;
        }
        if (result.lastEmbeddingPreflight !== null) {
          this.lastEmbeddingPreflight = result.lastEmbeddingPreflight;
        }
      }
    } finally {
      this.scheduledPreflightInFlight = false;
    }
    return this.lastScheduledPreflight;
  }

  stopScheduledPreflight() {
    this.scheduledPreflightEnabled = false;
    if (this.scheduledPreflightTimer) {
      clearTimeout(this.scheduledPreflightTimer);
      this.scheduledPreflightTimer = null;
      logger.info('Scheduled Ollama preflight check stopped');
    }
  }

  getLastScheduledPreflight() {
    return {
      ai: this.lastScheduledPreflight,
      embedding: this.lastEmbeddingPreflight,
    };
  }

  async warmModel(model, keepAlive = '24h', host = null, port = null) {
    return warmModel(() => this.getConfig(), model, keepAlive, host, port);
  }

  async warmEmbeddingModel(model, keepAlive = '24h', host = null, port = null) {
    return warmEmbeddingModel(() => this.getConfig(), model, keepAlive, host, port);
  }

  async warmAllModels(keepAlive = '24h') {
    return warmAllModels(() => this.getConfig(), keepAlive);
  }

  resetConfig() {
    this.host = null;
    this.port = null;
    this.model = null;
    this.baseUrl = null;
    this.preflightCache.clear();
  }

  getDefaultOllamaHost() {
    return 'localhost';
  }

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

  updateTokenCount(count) {
    this.currentGeneration.tokenCount = count;
  }

  async getConfig() {
    if (this.baseUrl) {
      return { host: this.host, port: this.port, baseUrl: this.baseUrl, model: this.model };
    }

    const result = await db.query('SELECT id, host, port, model FROM ollama_config WHERE is_active = true LIMIT 1');
    if (result.rows.length > 0) {
      this.host = result.rows[0].host;
      this.port = result.rows[0].port;
      this.model = result.rows[0].model;
    } else {
      const aiResult = await db.query('SELECT ollama_host, ollama_port, ollama_model FROM ai_provider_config WHERE id = 1');
      if (aiResult.rows.length > 0 && aiResult.rows[0].ollama_host) {
        this.host = aiResult.rows[0].ollama_host;
        this.port = aiResult.rows[0].ollama_port || 11434;
        this.model = aiResult.rows[0].ollama_model;
      } else {
        this.host = process.env.OLLAMA_HOST || 'localhost';
        this.port = process.env.OLLAMA_PORT || 11434;
        this.model = null;
      }
    }

    this.baseUrl = `http://${this.host}:${this.port}`;
    return { host: this.host, port: this.port, baseUrl: this.baseUrl, model: this.model };
  }

  parseDurationMs(value, fallback, minimum = 0) {
    return parseDurationMs(value, fallback, minimum);
  }

  parseCacheMs(cacheMs, fallback = 60000) {
    return parseCacheMs(cacheMs, fallback);
  }

  scheduleNextScheduledPreflight(delayMs, trigger = 'scheduled') {
    if (!this.scheduledPreflightEnabled) {
      return { delayMs: null, nextScheduledAt: null, trigger };
    }

    const resolvedDelayMs = parseDurationMs(
      delayMs,
      this.scheduledPreflightBaseIntervalMs,
      MIN_TIMEOUT_MS,
    );

    if (this.scheduledPreflightTimer) {
      clearTimeout(this.scheduledPreflightTimer);
    }

    const nextScheduledAt = new Date(Date.now() + resolvedDelayMs).toISOString();
    this.scheduledPreflightTimer = setTimeout(async () => {
      this.scheduledPreflightTimer = null;
      await this.runScheduledPreflight(trigger);
    }, resolvedDelayMs);

    return {
      delayMs: resolvedDelayMs,
      nextScheduledAt,
      trigger,
    };
  }

  async testConnection(host = null, port = null, options = {}) {
    return _testConnection(() => this.getConfig(), host, port, options);
  }

  async probeGeneration(host, port, model, options = {}) {
    return _probeGeneration(host, port, model, options);
  }

  async preflightConnection(options = {}) {
    return _preflightConnection(() => this.getConfig(), this.preflightCache, options);
  }

  async getModels(host = null, port = null) {
    return _getModels(() => this.getConfig(), host, port);
  }

  async getLoadedModels(host = null, port = null) {
    return _getLoadedModels(() => this.getConfig(), host, port);
  }

  async isModelLoaded(modelName, host = null, port = null) {
    return _isModelLoaded(() => this.getConfig(), modelName, host, port);
  }

  async generate(prompt, model = 'qwen3:14b', temperature = 0.30, options = {}) {
    return _generate(() => this.getConfig(), prompt, model, temperature, options);
  }

  async embed(text, model = 'nomic-embed-text-v2-moe', keepAlive = '5m', signal = null) {
    return _embed(
      () => this.getConfig(),
      () => this.getModels(),
      (m, s) => this.pullModel(m, s),
      text,
      model,
      keepAlive,
      signal,
    );
  }

  async pullModel(model, signal = null) {
    return _pullModel(() => this.getConfig(), model, signal);
  }

  async generateWithProgress(
    prompt,
    model = 'qwen3:14b',
    temperature = 0.30,
    onProgress = null,
    externalController = null,
    options = {},
  ) {
    return _generateWithProgress(
      () => this.getConfig(),
      (opts) => this.preflightConnection(opts),
      prompt,
      model,
      temperature,
      onProgress,
      externalController,
      options,
    );
  }

  async _streamGenerate(config, prompt, model, temperature, onProgress, controller, options = {}) {
    return _streamGenerate(
      () => this.getConfig(),
      (opts) => this.preflightConnection(opts),
      config,
      prompt,
      model,
      temperature,
      onProgress,
      controller,
      options,
    );
  }

  getRecommendedModels() {
    return getRecommendedModels();
  }
}

export const ollamaService = new OllamaService();
