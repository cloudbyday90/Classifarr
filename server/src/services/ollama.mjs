/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import axios from 'axios';
import os from 'node:os';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';
import { OperationController } from '../utils/operationController.mjs';

const logger = createLogger('OllamaService');
const DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CONNECTIVITY_TIMEOUT_MS = 5000;
const DEFAULT_PROBE_TIMEOUT_MS = 15000;
const DEFAULT_PREFLIGHT_RETRY_BASE_MS = 5 * 60 * 1000;
const DEFAULT_PREFLIGHT_RETRY_MAX_MS = 60 * 60 * 1000;
const DEFAULT_PREFLIGHT_WARN_DEDUPE_MS = 30 * 60 * 1000;
const MIN_TIMEOUT_MS = 1000;

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
    this.scheduledPreflightBaseIntervalMs = this.parseDurationMs(
      intervalMs,
      DEFAULT_SCHEDULED_PREFLIGHT_INTERVAL_MS,
      MIN_TIMEOUT_MS
    );

    const nextRun = this.scheduleNextScheduledPreflight(
      this.scheduledPreflightBaseIntervalMs,
      'scheduled'
    );

    logger.info('Scheduled Ollama preflight check started', {
      intervalHours: this.scheduledPreflightBaseIntervalMs / (60 * 60 * 1000),
      connectivityTimeoutMs: this.getConnectivityTimeoutMs(),
      probeTimeoutMs: this.getProbeTimeoutMs(),
      retryBaseMs: this.getScheduledPreflightRetryBaseMs(),
      retryMaxMs: this.getScheduledPreflightRetryMaxMs(),
      nextScheduledAt: nextRun.nextScheduledAt
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
      try {
        const config = await this.getConfig();
        if (!config.host) {
          const nextRun = this.scheduleNextScheduledPreflight(this.scheduledPreflightBaseIntervalMs, 'scheduled');
          this.lastScheduledPreflight = {
            success: false,
            host: null,
            port: null,
            model: null,
            skipped: true,
            reason: 'host_not_configured',
            checkedAt: new Date().toISOString(),
            nextAttemptInMs: nextRun.delayMs,
            nextScheduledAt: nextRun.nextScheduledAt,
            consecutiveFailures: 0
          };
          logger.info('Scheduled Ollama preflight skipped because host is not configured', {
            nextScheduledAt: nextRun.nextScheduledAt
          });
          return;
        }

        let embeddingModel = null;
        try {
          const embedResult = await db.query('SELECT embedding_model, embedding_ollama_model FROM ai_provider_config WHERE id = 1');
          const row = embedResult.rows[0];
          embeddingModel = row?.embedding_model || row?.embedding_ollama_model || null;
        } catch (error) {
          logger.warn('Failed to load embedding model for scheduled Ollama preflight', {
            error: error.message
          }, {
            dedupeKey: 'scheduled-embedding-model-query',
            dedupeWindowMs: this.getScheduledWarnDedupeMs()
          });
        }

        const connectivityTimeoutMs = this.getConnectivityTimeoutMs();
        const probeTimeoutMs = this.getProbeTimeoutMs();

        const result = await this.preflightConnection({
          host: config.host,
          port: config.port,
          model: config.model,
          probeGeneration: true,
          force: true,
          includeModels: true,
          connectivityTimeoutMs,
          probeTimeoutMs
        });

        if (result.success) {
          const recoveredFailures = this.scheduledPreflightFailureCount;
          this.scheduledPreflightFailureCount = 0;

          if (embeddingModel && embeddingModel !== config.model) {
            const embedResult = await this.preflightConnection({
              host: config.host,
              port: config.port,
              model: embeddingModel,
              probeGeneration: false,
              force: true,
              includeModels: false,
              connectivityTimeoutMs
            });
            this.lastEmbeddingPreflight = {
              ...embedResult,
              checkedAt: new Date().toISOString(),
              trigger
            };
            if (embedResult.success) {
              logger.info('Scheduled Ollama embedding model preflight passed', {
                model: embeddingModel,
                available: true
              });
            } else {
              logger.warn('Scheduled Ollama embedding model preflight failed', {
                host: embedResult.host,
                port: embedResult.port,
                model: embeddingModel,
                error: embedResult.error,
                errorCode: embedResult.errorCode,
                failureType: embedResult.failureType
              }, {
                dedupeKey: `scheduled-embedding-preflight:${embedResult.host}:${embedResult.port}:${embeddingModel}:${embedResult.failureType || embedResult.errorCode || 'unknown'}`,
                dedupeWindowMs: this.getScheduledWarnDedupeMs()
              });
            }
          }

          const nextRun = this.scheduleNextScheduledPreflight(this.scheduledPreflightBaseIntervalMs, 'scheduled');
          this.lastScheduledPreflight = {
            ...result,
            checkedAt: new Date().toISOString(),
            trigger,
            connectivityTimeoutMs,
            probeTimeoutMs,
            consecutiveFailures: 0,
            nextAttemptInMs: nextRun.delayMs,
            nextScheduledAt: nextRun.nextScheduledAt
          };

          if (recoveredFailures > 0) {
            logger.info('Scheduled Ollama preflight recovered', {
              host: result.host,
              port: result.port,
              model: config.model,
              modelCount: result.models?.length || 0,
              latencyMs: result.latency_ms,
              recoveredAfterFailures: recoveredFailures,
              nextScheduledAt: nextRun.nextScheduledAt
            });
          } else {
            logger.info('Scheduled Ollama preflight passed', {
              host: result.host,
              port: result.port,
              model: config.model,
              modelCount: result.models?.length || 0,
              latencyMs: result.latency_ms,
              nextScheduledAt: nextRun.nextScheduledAt
            });
          }
        } else {
          this.scheduledPreflightFailureCount += 1;
          const retryDelayMs = this.getScheduledPreflightRetryDelayMs(this.scheduledPreflightFailureCount);
          const nextRun = this.scheduleNextScheduledPreflight(retryDelayMs, 'retry');
          this.lastScheduledPreflight = {
            ...result,
            checkedAt: new Date().toISOString(),
            trigger,
            connectivityTimeoutMs,
            probeTimeoutMs,
            consecutiveFailures: this.scheduledPreflightFailureCount,
            nextAttemptInMs: nextRun.delayMs,
            nextScheduledAt: nextRun.nextScheduledAt
          };

          logger.warn('Scheduled Ollama preflight failed', {
            host: result.host,
            port: result.port,
            model: config.model,
            error: result.error,
            errorCode: result.errorCode,
            failureType: result.failureType,
            consecutiveFailures: this.scheduledPreflightFailureCount,
            nextAttemptInMs: nextRun.delayMs,
            nextScheduledAt: nextRun.nextScheduledAt
          }, {
            dedupeKey: `scheduled-preflight:${result.host}:${result.port}:${config.model || 'none'}:${result.failureType || result.errorCode || 'unknown'}`,
            dedupeWindowMs: this.getScheduledWarnDedupeMs()
          });
        }
      } catch (error) {
        this.scheduledPreflightFailureCount += 1;
        const retryDelayMs = this.getScheduledPreflightRetryDelayMs(this.scheduledPreflightFailureCount);
        const nextRun = this.scheduleNextScheduledPreflight(retryDelayMs, 'retry');
        this.lastScheduledPreflight = {
          success: false,
          host: null,
          port: null,
          model: null,
          checkedAt: new Date().toISOString(),
          trigger,
          error: error.message,
          errorCode: error.code || 'EOLLAMA_SCHEDULED_PREFLIGHT',
          failureType: this.classifyPreflightFailure(error.code, error.message, 'scheduled'),
          consecutiveFailures: this.scheduledPreflightFailureCount,
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt
        };

        logger.error('Scheduled Ollama preflight error', {
          error: error.message,
          errorCode: error.code || null,
          failureType: this.lastScheduledPreflight.failureType,
          consecutiveFailures: this.scheduledPreflightFailureCount,
          nextAttemptInMs: nextRun.delayMs,
          nextScheduledAt: nextRun.nextScheduledAt
        }, {
          error
        });
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

  async testConnection(host = null, port = null, options = {}) {
    try {
      const config = await this.getConfig();
      const testHost = host || config.host;
      const testPort = port || config.port;
      const testUrl = `http://${testHost}:${testPort}`;

      const response = await axios.get(`${testUrl}/api/tags`, {
        timeout: this.getConnectivityTimeoutMs(options?.timeoutMs),
      });

      return {
        success: true,
        models: response.data.models,
        message: 'Connection successful'
      };
    } catch (error) {
      let errorMessage = error.message;

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

  parseDurationMs(value, fallback, minimum = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
  }

  parseCacheMs(cacheMs, fallback = 60000) {
    return this.parseDurationMs(cacheMs, fallback, 0);
  }

  getConnectivityTimeoutMs(timeoutMs = process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS) {
    return this.parseDurationMs(timeoutMs, DEFAULT_CONNECTIVITY_TIMEOUT_MS, MIN_TIMEOUT_MS);
  }

  getProbeTimeoutMs(timeoutMs = process.env.OLLAMA_PROBE_TIMEOUT_MS) {
    return this.parseDurationMs(timeoutMs, DEFAULT_PROBE_TIMEOUT_MS, MIN_TIMEOUT_MS);
  }

  getScheduledPreflightRetryBaseMs(value = process.env.OLLAMA_PREFLIGHT_RETRY_BASE_MS) {
    return this.parseDurationMs(value, DEFAULT_PREFLIGHT_RETRY_BASE_MS, MIN_TIMEOUT_MS);
  }

  getScheduledPreflightRetryMaxMs(value = process.env.OLLAMA_PREFLIGHT_RETRY_MAX_MS) {
    const baseMs = this.getScheduledPreflightRetryBaseMs();
    return this.parseDurationMs(value, DEFAULT_PREFLIGHT_RETRY_MAX_MS, baseMs);
  }

  getScheduledWarnDedupeMs(value = process.env.OLLAMA_PREFLIGHT_WARN_DEDUPE_MS) {
    return this.parseDurationMs(value, DEFAULT_PREFLIGHT_WARN_DEDUPE_MS, MIN_TIMEOUT_MS);
  }

  getScheduledPreflightRetryDelayMs(failureCount) {
    const baseMs = this.getScheduledPreflightRetryBaseMs();
    const maxMs = this.getScheduledPreflightRetryMaxMs();
    const attempt = Math.max(0, failureCount - 1);
    const cappedDelayMs = Math.min(maxMs, baseMs * (2 ** attempt));
    return Math.max(MIN_TIMEOUT_MS, Math.floor(Math.random() * cappedDelayMs));
  }

  scheduleNextScheduledPreflight(delayMs, trigger = 'scheduled') {
    if (!this.scheduledPreflightEnabled) {
      return { delayMs: null, nextScheduledAt: null, trigger };
    }

    const resolvedDelayMs = this.parseDurationMs(
      delayMs,
      this.scheduledPreflightBaseIntervalMs,
      MIN_TIMEOUT_MS
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
      trigger
    };
  }

  classifyPreflightFailure(errorCode, errorMessage, stage = 'connectivity') {
    if (stage === 'model') {
      return 'model_not_found';
    }

    const normalizedCode = String(errorCode || '').trim().toUpperCase();
    const normalizedMessage = String(errorMessage || '').toLowerCase();
    const prefix = stage === 'generation'
      ? 'generation'
      : stage === 'scheduled'
        ? 'scheduled'
        : 'connectivity';

    if (normalizedCode === 'ECONNREFUSED') {
      return `${prefix}_connection_refused`;
    }

    if (normalizedCode === 'ENOTFOUND') {
      return `${prefix}_dns_error`;
    }

    if (normalizedCode === 'EHOSTUNREACH') {
      return `${prefix}_host_unreachable`;
    }

    if (normalizedCode === 'ETIMEDOUT' || normalizedCode === 'ECONNABORTED' || normalizedMessage.includes('timeout')) {
      return `${prefix}_timeout`;
    }

    return `${prefix}_failed`;
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

  async probeGeneration(host, port, model, options = {}) {
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
        timeout: this.getProbeTimeoutMs(options?.timeoutMs),
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
      cacheMs = process.env.OLLAMA_PREFLIGHT_CACHE_MS,
      connectivityTimeoutMs = process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS,
      probeTimeoutMs = process.env.OLLAMA_PROBE_TIMEOUT_MS
    } = options || {};

    const config = await this.getConfig();
    const testHost = host || config.host;
    const testPort = Number(port || config.port || 11434);
    const modelName = this.normalizeModelName(model);
    const resolvedCacheMs = this.parseCacheMs(cacheMs, 60000);
    const resolvedConnectivityTimeoutMs = this.getConnectivityTimeoutMs(connectivityTimeoutMs);
    const resolvedProbeTimeoutMs = this.getProbeTimeoutMs(probeTimeoutMs);
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
    const connection = await this.testConnection(testHost, testPort, {
      timeoutMs: resolvedConnectivityTimeoutMs
    });
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
      errorCode: null,
      failureType: null
    };

    if (!connection.success) {
      result.error = connection.error || 'Connection failed';
      result.errorCode = connection.errorCode || 'EOLLAMA_CONNECT';
      result.failureType = this.classifyPreflightFailure(result.errorCode, result.error, 'connectivity');
      result.message = result.error;
      this.preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
      return result;
    }

    const models = Array.isArray(connection.models) ? connection.models : [];
    const modelMatch = modelName ? this.findModelMatch(models, modelName) : null;

    if (modelName && !modelMatch) {
      result.error = `Model '${modelName}' is not available on ${testHost}:${testPort}`;
      result.errorCode = 'MODEL_NOT_FOUND';
      result.failureType = this.classifyPreflightFailure(result.errorCode, result.error, 'model');
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
        const probe = await this.probeGeneration(testHost, testPort, modelName, {
          timeoutMs: resolvedProbeTimeoutMs
        });
        result.checks.generation_probe = {
          ok: true,
          skipped: false,
          latency_ms: probe.latency_ms
        };
      } catch (error) {
        result.error = `Connected, but generation probe failed: ${error.message}`;
        result.errorCode = error.code || 'EGEN_PROBE';
        result.failureType = this.classifyPreflightFailure(result.errorCode, error.message, 'generation');
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
      logger.warn('Failed to get loaded models', { error: error.message });
      return [];
    }
  }

  async isModelLoaded(modelName, host = null, port = null) {
    const loadedModels = await this.getLoadedModels(host, port);
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
        timeout: 120000,
      });
      return response.data.response;
    } catch (error) {
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  async embed(text, model = 'nomic-embed-text-v2-moe', keepAlive = '5m', signal = null) {
    try {
      const config = await this.getConfig();

      const models = await this.getModels();
      const modelExists = models.some(m => m.name === model || m.name.startsWith(model));

      if (!modelExists) {
        logger.info(`[Ollama] Embedding model ${model} not found, attempting to pull...`);
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
      logger.info(`[Ollama] Pulling model: ${model}`);

      const _response = await axios.post(`${config.baseUrl}/api/pull`, {
        name: model,
        stream: false,
      }, {
        timeout: 300000,
        signal: signal
      });

      logger.info(`[Ollama] Model ${model} pulled successfully`);
      return true;
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw error;
      }
      logger.error(`[Ollama] Failed to pull model ${model}: ${error.message}`);
      throw new Error(`Failed to pull model ${model}: ${error.message}`);
    }
  }

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
      let lineBuffer = '';

      const processStreamBuffer = (chunkText = '', flush = false) => {
        lineBuffer += chunkText;
        const lines = lineBuffer.split('\n');

        if (!flush) {
          lineBuffer = lines.pop() || '';
        } else {
          lineBuffer = '';
        }

        for (const rawLine of lines) {
          if (resolved) {
            return;
          }

          const line = rawLine.trim();
          if (!line) {
            continue;
          }

          let json;
          try {
            json = JSON.parse(line);
          } catch {
            continue;
          }

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
            return;
          }
        }
      };

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

          processStreamBuffer(chunk.toString(), false);
        });

        response.data.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            reject(new Error(`Stream error: ${err.message}`));
          }
        });

        response.data.on('end', () => {
          processStreamBuffer('', true);

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

export default new OllamaService();
