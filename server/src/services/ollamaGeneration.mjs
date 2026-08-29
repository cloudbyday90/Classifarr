import { httpPost, httpStream } from '../utils/httpClient.mjs';
import { createLogger } from '../utils/logger.mjs';
import { OperationController } from '../utils/operationController.mjs';
import { buildOllamaGenerateRequest } from './ollamaGenerateRequest.mjs';

const logger = createLogger('OllamaGeneration');

// Default streaming stall budgets for ollama generation. Callers may override
// any of these via the options object (e.g. larger budgets for reasoning
// models that spend time "thinking" before/while streaming tokens).
const DEFAULT_GENERATION_INITIAL_TIMEOUT_MS = 120000; // wait for first token
const DEFAULT_GENERATION_HEARTBEAT_TIMEOUT_MS = 60000; // gap between tokens
const DEFAULT_GENERATION_HARD_TIMEOUT_MS = 300000; // absolute completion cap

/**
 * @typedef {Error & {
 *   code?: string,
 *   response?: unknown,
 *   status?: unknown,
 *   statusCode?: unknown,
 *   partialResponse?: string,
 * }} OllamaGenerationError
 */

function wrapGenerationError(prefix, error) {
  const source = /** @type {OllamaGenerationError} */ (error);
  const wrapped = /** @type {OllamaGenerationError} */ (
    new Error(`${prefix}: ${source.message}`)
  );
  wrapped.name = source.name || 'Error';
  wrapped.code = source.code;
  wrapped.response = source.response;
  wrapped.status = source.status;
  wrapped.statusCode = source.statusCode;
  wrapped.cause = source;
  return wrapped;
}

function createPreflightError(preflight = {}) {
  const error = /** @type {OllamaGenerationError} */ (
    new Error(preflight.error || 'Ollama connection failed')
  );
  error.code = typeof preflight.errorCode === 'string'
    ? preflight.errorCode
    : 'EOLLAMA_PREFLIGHT';
  return error;
}

export async function generate(getConfig, prompt, model = 'qwen3:14b', temperature = 0.30, options = {}) {
  try {
    const config = await getConfig();
    const body = buildOllamaGenerateRequest({
      model,
      prompt,
      stream: false,
      temperature,
      format: options.format,
      keepAlive: options.keepAlive,
      think: options.think,
    });
    const response = await httpPost(`${config.baseUrl}/api/generate`, body, {
      timeout: Number.isSafeInteger(options.timeoutMs) && options.timeoutMs >= 1000
        ? options.timeoutMs
        : 120000,
    });
    return response.data.response;
  } catch (error) {
    throw wrapGenerationError('Failed to generate response', error);
  }
}

export async function embed(getConfig, getModelsFn, pullModelFn, text, model = 'nomic-embed-text-v2-moe', keepAlive = '5m', signal = null) {
  try {
    const config = await getConfig();

    const models = await getModelsFn();
    const modelExists = models.some(m => m.name === model || m.name.startsWith(model));

    if (!modelExists) {
      logger.info(`[Ollama] Embedding model ${model} not found, attempting to pull...`);
      await pullModelFn(model, signal);
    }

    const response = await httpPost(`${config.baseUrl}/api/embed`, {
      model,
      input: text,
      keep_alive: keepAlive,
    }, {
      timeout: 300000,
      signal: signal,
    });

    const embedding = response.data.embeddings?.[0] || response.data.embedding;
    return {
      embedding: embedding,
      dims: embedding.length,
    };
  } catch (error) {
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      throw error;
    }
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

export async function pullModel(getConfig, model, signal = null) {
  try {
    const config = await getConfig();
    logger.info(`[Ollama] Pulling model: ${model}`);

    const _response = await httpPost(`${config.baseUrl}/api/pull`, {
      name: model,
      stream: false,
    }, {
      timeout: 300000,
      signal: signal,
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

export async function generateWithProgress(
  getConfig,
  preflightConnectionFn,
  prompt,
  model = 'qwen3:14b',
  temperature = 0.30,
  onProgress = null,
  externalController = null,
  options = {},
) {
  const config = await getConfig();
  const generateOptions = {
    allowPartialOnStall: options.allowPartialOnStall !== false,
    allowPartialOnAbort: options.allowPartialOnAbort !== false,
    requireDoneSignal: options.requireDoneSignal === true,
    format: options.format,
    think: options.think,
    expectedModelDigest: options.expectedModelDigest,
  };

  if (externalController) {
    return streamGenerate(getConfig, preflightConnectionFn, config, prompt, model, temperature, onProgress, externalController, generateOptions);
  }

  const controller = new OperationController({
    mode: 'streaming',
    initialTimeout: Number.isFinite(options.initialTimeout) ? options.initialTimeout : DEFAULT_GENERATION_INITIAL_TIMEOUT_MS,
    heartbeatTimeout: Number.isFinite(options.heartbeatTimeout) ? options.heartbeatTimeout : DEFAULT_GENERATION_HEARTBEAT_TIMEOUT_MS,
    hardTimeout: Number.isFinite(options.hardTimeout) ? options.hardTimeout : DEFAULT_GENERATION_HARD_TIMEOUT_MS,
    allowPartialOnStall: generateOptions.allowPartialOnStall,
  });

  return controller.runStreaming(
    (signal, ctrl) => streamGenerate(getConfig, preflightConnectionFn, config, prompt, model, temperature, onProgress, ctrl, generateOptions),
    'ollama_generate',
  );
}

export async function streamGenerate(getConfig, preflightConnectionFn, config, prompt, model, temperature, onProgress, controller, options = {}) {
  const preflight = await preflightConnectionFn({
    host: config.host,
    port: config.port,
    model: model,
    probeGeneration: false,
    cacheMs: 60000,
    expectedModelDigest: options.expectedModelDigest,
  });

  if (!preflight.success) {
    throw createPreflightError(preflight);
  }

  let fullResponse = '';
  let tokenCount = 0;
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

      if (json.done) {
        sawDoneSignal = true;
      }
    }
  };

  try {
    const body = buildOllamaGenerateRequest({
      model,
      prompt,
      stream: true,
      temperature,
      format: options.format,
      think: options.think,
    });
    const streamResponse = await httpStream(`${config.baseUrl}/api/generate`, body, {
      signal: controller.signal,
    });

    const decoder = new TextDecoder();
    for await (const chunk of streamResponse.body) {
      controller.recordActivity();
      processStreamBuffer(decoder.decode(chunk, { stream: true }), false);
      if (sawDoneSignal) {
        break;
      }
    }

    processStreamBuffer(decoder.decode(), true);

    if (fullResponse && (!options.requireDoneSignal || sawDoneSignal)) {
      if (onProgress) {
        onProgress(tokenCount, true);
      }
      return fullResponse;
    } else if (fullResponse && options.requireDoneSignal && !sawDoneSignal) {
      const incompleteError = /** @type {OllamaGenerationError} */ (
        new Error('Generation ended before completion signal')
      );
      incompleteError.name = 'IncompleteStreamError';
      incompleteError.code = 'EINCOMPLETE';
      incompleteError.partialResponse = fullResponse;
      throw incompleteError;
    } else {
      throw new Error('Empty response from model');
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.code === 'ABORT_ERR') {
      if (controller.partialResult && options.allowPartialOnAbort) {
        return controller.partialResult;
      } else {
        const abortError = /** @type {OllamaGenerationError} */ (
          new Error(
            controller.partialResult
              ? 'Generation aborted with partial response blocked'
              : 'Generation aborted',
          )
        );
        abortError.name = 'AbortError';
        abortError.code = 'ABORT_ERR';
        if (controller.partialResult) {
          abortError.partialResponse = controller.partialResult;
        }
        throw abortError;
      }
    } else if (err.name === 'IncompleteStreamError') {
      throw err;
    } else {
      throw wrapGenerationError('Failed to generate', err);
    }
  }
}
