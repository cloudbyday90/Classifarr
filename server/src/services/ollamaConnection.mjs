import { httpGet, httpPost } from '../utils/httpClient.mjs';
import os from 'node:os';
import { createLogger } from '../utils/logger.mjs';
import {
  buildAiRuntimeDedupeKey,
  AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
} from './aiEmbeddingProviderIntegrityService.mjs';
import {
  getConnectivityTimeoutMs,
  getProbeTimeoutMs,
  getProbeContextLength,
  classifyPreflightFailure,
  normalizeModelName,
  findModelMatch,
  buildPreflightCacheKey,
  parseCacheMs,
} from './ollamaPreflightUtils.mjs';
import { normalizeOllamaModelDigest } from './ollamaVerificationCapabilityIdentity.mjs';

const logger = createLogger('OllamaConnection');

export async function testConnection(getConfig, host = null, port = null, options = {}) {
  try {
    const config = await getConfig();
    const testHost = host || config.host;
    const testPort = port || config.port;
    const testUrl = `http://${testHost}:${testPort}`;

    const response = await httpGet(`${testUrl}/api/tags`, {
      timeout: getConnectivityTimeoutMs(options?.timeoutMs),
    });

    return {
      success: true,
      models: response.data.models,
      message: 'Connection successful',
    };
  } catch (error) {
    let errorMessage = error.message;

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused - is Ollama running?';
    } else if (error.code === 'ENOTFOUND') {
      if (host === 'host.docker.internal' && os.platform() === 'linux') {
        errorMessage = `Cannot resolve hostname '${host}'. This hostname is not available on Linux. Try using the detected gateway IP, or use your Ollama container name if on the same Docker network.`;
      } else {
        errorMessage = `Cannot resolve hostname '${host || error.hostname || 'unknown'}'. Check that the hostname or IP address is correct.`;
      }
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Connection timed out. Verify the host (${host || 'unknown'}) is reachable and port ${port || 11434} is accessible.`;
    } else if (error.code === 'EHOSTUNREACH') {
      errorMessage = `Host unreachable. Check network connectivity to ${host || 'unknown'}.`;
    }

    return {
      success: false,
      error: errorMessage,
      errorCode: error.code,
    };
  }
}

export async function probeGeneration(host, port, model, options = {}) {
  const testUrl = `http://${host}:${port}`;
  const startedAt = Date.now();
  const contextLength = getProbeContextLength(options?.contextLength);

  await httpPost(
    `${testUrl}/api/generate`,
    {
      model,
      prompt: 'Reply with OK only.',
      stream: false,
      options: {
        temperature: 0,
        num_predict: 4,
        num_ctx: contextLength,
      },
    },
    {
      timeout: getProbeTimeoutMs(options?.timeoutMs),
    },
  );

  return {
    ok: true,
    latency_ms: Date.now() - startedAt,
  };
}

export async function preflightConnection(getConfig, preflightCache, options = {}) {
  const {
    host = null,
    port = null,
    model = null,
    probeGeneration: shouldProbe = false,
    expectedModelDigest = null,
    force = false,
    includeModels = true,
    cacheMs = process.env.OLLAMA_PREFLIGHT_CACHE_MS,
    connectivityTimeoutMs = process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS,
    probeTimeoutMs = process.env.OLLAMA_PROBE_TIMEOUT_MS,
    probeContextLength = process.env.OLLAMA_PROBE_CONTEXT_LENGTH,
  } = options || {};

  const config = await getConfig();
  const testHost = host || config.host;
  const testPort = Number(port || config.port || 11434);
  const modelName = normalizeModelName(model);
  const resolvedCacheMs = parseCacheMs(cacheMs, 60000);
  const resolvedConnectivityTimeoutMs = getConnectivityTimeoutMs(connectivityTimeoutMs);
  const resolvedProbeTimeoutMs = getProbeTimeoutMs(probeTimeoutMs);
  const resolvedProbeContextLength = getProbeContextLength(probeContextLength);
  const normalizedExpectedModelDigest = normalizeOllamaModelDigest(expectedModelDigest);
  const cacheKey = buildPreflightCacheKey({
    host: testHost,
    port: testPort,
    model: modelName,
    probeGeneration: shouldProbe,
    expectedModelDigest: normalizedExpectedModelDigest,
  });

  if (!force && resolvedCacheMs > 0) {
    const cached = preflightCache.get(cacheKey);
    if (cached && (Date.now() - cached.checkedAt) < resolvedCacheMs) {
      return {
        ...cached.result,
        cached: true,
      };
    }
  }

  const startedAt = Date.now();
  const connection = await testConnection(getConfig, testHost, testPort, {
    timeoutMs: resolvedConnectivityTimeoutMs,
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
        errorCode: connection.errorCode || null,
      },
      model_available: {
        ok: modelName ? null : true,
        value: modelName ? null : true,
      },
      generation_probe: {
        ok: shouldProbe ? null : false,
        skipped: !shouldProbe,
      },
    },
    message: '',
    error: null,
    errorCode: null,
    failureType: null,
  };

  if (!connection.success) {
    result.error = connection.error || 'Connection failed';
    result.errorCode = connection.errorCode || 'EOLLAMA_CONNECT';
    result.failureType = classifyPreflightFailure(result.errorCode, result.error, 'connectivity');
    result.message = result.error;
    preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
    return result;
  }

  const models = Array.isArray(connection.models) ? connection.models : [];
  const modelMatch = modelName ? findModelMatch(models, modelName) : null;

  if (modelName && !modelMatch) {
    result.error = `Model '${modelName}' is not available on ${testHost}:${testPort}`;
    result.errorCode = 'MODEL_NOT_FOUND';
    result.failureType = classifyPreflightFailure(result.errorCode, result.error, 'model');
    result.message = result.error;
    result.checks.model_available = {
      ok: false,
      value: false,
    };
    if (includeModels) {
      result.models = models;
    }
    preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
    return result;
  }

  result.checks.model_available = {
    ok: true,
    value: true,
  };

  if (normalizedExpectedModelDigest && normalizeOllamaModelDigest(modelMatch?.digest) !== normalizedExpectedModelDigest) {
    result.error = 'The configured Ollama model changed after its verification test.';
    result.errorCode = 'MODEL_DIGEST_MISMATCH';
    result.failureType = 'model_changed';
    result.message = result.error;
    result.checks.model_available = {
      ok: false,
      value: false,
      errorCode: result.errorCode,
    };
    if (includeModels) {
      result.models = models;
    }
    preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
    return result;
  }

  if (shouldProbe && modelName) {
    try {
      const probeResult = await probeGeneration(testHost, testPort, modelName, {
        timeoutMs: resolvedProbeTimeoutMs,
        contextLength: resolvedProbeContextLength,
      });
      result.checks.generation_probe = {
        ok: true,
        skipped: false,
        latency_ms: probeResult.latency_ms,
        num_ctx: resolvedProbeContextLength,
      };
    } catch (error) {
      result.error = `Connected, but generation probe failed: ${error.message}`;
      result.errorCode = error.code || 'EGEN_PROBE';
      result.failureType = classifyPreflightFailure(result.errorCode, error.message, 'generation');
      result.message = result.error;
      result.checks.generation_probe = {
        ok: false,
        skipped: false,
        error: error.message,
        errorCode: error.code || null,
        num_ctx: resolvedProbeContextLength,
      };
      if (includeModels) {
        result.models = models;
      }
      preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
      return result;
    }
  }

  result.success = true;
  result.message = shouldProbe && modelName
    ? `Connection successful - model '${modelName}' is ready`
    : 'Connection successful';
  result.latency_ms = Date.now() - startedAt;
  result.model_available = modelName ? true : null;
  if (includeModels) {
    result.models = models;
  }

  preflightCache.set(cacheKey, { result, checkedAt: Date.now() });
  return result;
}

export async function getModels(getConfig, host = null, port = null) {
  try {
    const config = await getConfig();
    const testHost = host || config.host;
    const testPort = port || config.port;
    const testUrl = `http://${testHost}:${testPort}`;

    const response = await httpGet(`${testUrl}/api/tags`);
    return response.data.models || [];
  } catch (error) {
    throw new Error(`Failed to fetch models: ${error.message}`);
  }
}

export async function getVersion(getConfig, options = {}) {
  const config = await getConfig();
  const timeout = getConnectivityTimeoutMs(options?.timeoutMs);
  const response = await httpGet(`${config.baseUrl}/api/version`, { timeout });
  return response.data?.version ?? null;
}

export async function getLoadedModels(getConfig, host = null, port = null) {
  try {
    const config = await getConfig();
    const testHost = host || config.host;
    const testPort = port || config.port;
    const testUrl = `http://${testHost}:${testPort}`;

    const response = await httpGet(`${testUrl}/api/ps`, {
      timeout: 5000,
    });
    return response.data.models || [];
  } catch (error) {
    logger.warn('Failed to get loaded models', { error: error.message }, {
      dedupeKey: buildAiRuntimeDedupeKey(
        'loaded_models_failed',
        `${host || 'default'}:${port || 'default'}:${error.code || error.message || 'unknown'}`,
      ),
      dedupeWindowMs: AI_EMBEDDING_WARNING_DEDUPE_WINDOW_MS,
    });
    return [];
  }
}

export async function isModelLoaded(getConfig, modelName, host = null, port = null) {
  const loadedModels = await getLoadedModels(getConfig, host, port);
  return loadedModels.some(m =>
    m.name === modelName
    || m.name.startsWith(modelName + ':')
    || modelName.startsWith(m.name.split(':')[0]),
  );
}
