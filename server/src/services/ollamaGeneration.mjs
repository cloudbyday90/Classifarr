import { httpPost, httpStream } from '../utils/httpClient.mjs';
import { createLogger } from '../utils/logger.mjs';
import { OperationController } from '../utils/operationController.mjs';

const logger = createLogger('OllamaGeneration');

export async function generate(getConfig, prompt, model = 'qwen3:14b', temperature = 0.30) {
  try {
    const config = await getConfig();
    const response = await httpPost(`${config.baseUrl}/api/generate`, {
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
  };

  if (externalController) {
    return streamGenerate(getConfig, preflightConnectionFn, config, prompt, model, temperature, onProgress, externalController, generateOptions);
  }

  const controller = new OperationController({
    mode: 'streaming',
    initialTimeout: 120000,
    heartbeatTimeout: 60000,
    hardTimeout: 300000,
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
  });

  if (!preflight.success) {
    throw new Error(preflight.error || 'Ollama connection failed');
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
    const streamResponse = await httpStream(`${config.baseUrl}/api/generate`, {
      model,
      prompt,
      temperature,
      stream: true,
    }, {
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
      const incompleteError = new Error('Generation ended before completion signal');
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
        const abortError = new Error(
          controller.partialResult
            ? 'Generation aborted with partial response blocked'
            : 'Generation aborted',
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
      throw new Error(`Failed to generate: ${err.message}`);
    }
  }
}
