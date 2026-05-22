/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { httpPost } from '../utils/httpClient.mjs';
import * as db from '../config/database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('ollamaModelWarming');

export async function warmModel(getConfig, model, keepAlive = '24h', host = null, port = null) {
  const config = await getConfig();
  const warmHost = host || config.host;
  const warmPort = port || config.port;
  const warmUrl = `http://${warmHost}:${warmPort}`;

  if (!warmHost) {
    throw new Error('Ollama host not configured');
  }

  const startedAt = Date.now();
  try {
    await httpPost(
      `${warmUrl}/api/generate`,
      {
        model,
        prompt: '',
        keep_alive: keepAlive,
      },
      { timeout: 60000 },
    );

    return {
      success: true,
      model,
      host: warmHost,
      port: warmPort,
      latency_ms: Date.now() - startedAt,
      keep_alive: keepAlive,
      message: `Model '${model}' loaded and will stay in memory for ${keepAlive}`,
    };
  } catch (error) {
    if (error.message && error.message.includes('does not support generate')) {
      return warmEmbeddingModel(getConfig, model, keepAlive, warmHost, warmPort);
    }
    return {
      success: false,
      model,
      host: warmHost,
      port: warmPort,
      error: error.message,
      errorCode: error.code || 'EWARM',
      message: `Failed to warm model '${model}': ${error.message}`,
    };
  }
}

export async function warmEmbeddingModel(getConfig, model, keepAlive = '24h', host = null, port = null) {
  const config = await getConfig();
  const warmHost = host || config.host;
  const warmPort = port || config.port;
  const warmUrl = `http://${warmHost}:${warmPort}`;

  if (!warmHost) {
    return {
      success: false,
      model,
      error: 'Ollama host not configured',
      message: 'Ollama host not configured',
    };
  }

  const startedAt = Date.now();
  try {
    await httpPost(
      `${warmUrl}/api/embed`,
      {
        model,
        input: 'warmup',
        keep_alive: keepAlive,
      },
      { timeout: 60000 },
    );

    return {
      success: true,
      model,
      host: warmHost,
      port: warmPort,
      latency_ms: Date.now() - startedAt,
      keep_alive: keepAlive,
      message: `Embedding model '${model}' loaded and will stay in memory for ${keepAlive}`,
    };
  } catch (error) {
    return {
      success: false,
      model,
      host: warmHost,
      port: warmPort,
      error: error.message,
      errorCode: error.code || 'EWARM',
      message: `Failed to warm embedding model '${model}': ${error.message}`,
    };
  }
}

export async function warmAllModels(getConfig, keepAlive = '24h') {
  const config = await getConfig();
  const results = {
    ai: null,
    embedding: null,
  };

  if (config.model) {
    results.ai = await warmModel(getConfig, config.model, keepAlive, config.host, config.port);
  }

  try {
    const embedResult = await db.query('SELECT embedding_model, embedding_ollama_model, embedding_provider FROM ai_provider_config WHERE id = 1');
    const row = embedResult.rows[0];
    const embeddingModel = row?.embedding_model || row?.embedding_ollama_model || null;
    if (embeddingModel && embeddingModel !== config.model) {
      results.embedding = await warmEmbeddingModel(getConfig, embeddingModel, keepAlive, config.host, config.port);
    }
  } catch {}

  return results;
}
