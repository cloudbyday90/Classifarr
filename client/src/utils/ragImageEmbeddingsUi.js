import { normalizeImageEmbeddingMode } from './ragConfigUi'

export function normalizeImageEmbeddingConfig(data = {}) {
  return {
    image_mode: normalizeImageEmbeddingMode(data.image_embedding_provider_mode || 'disabled'),
    image_local_host: data.image_embedding_local_host || '',
    image_local_port: data.image_embedding_local_port || 8000,
    image_local_model: data.image_embedding_local_model || 'ViT-B-16',
    image_cloud_provider: data.image_embedding_cloud_provider || '',
    image_cloud_api_key: data.image_embedding_cloud_api_key || '',
    image_cloud_model: data.image_embedding_cloud_model || '',
    image_cloud_api_endpoint: data.image_embedding_cloud_api_endpoint || '',
    image_size: data.image_embedding_image_size || 512,
    image_rps: data.image_embedding_rps || 2,
    image_concurrency: data.image_embedding_concurrency || 2,
    image_batch_size: data.image_embedding_batch_size || 1,
    image_cache_ttl_hours: data.image_embedding_cache_ttl_hours || 24,
    image_cache_max_mb: data.image_embedding_cache_max_mb || 1024,
    image_local_api_key: data.image_embedding_local_api_key || '',
    image_local_timeout_ms: data.image_embedding_local_timeout_ms || 15000,
  }
}

export function buildImageEmbeddingConnectionRequest(config = {}) {
  return {
    mode: config.image_mode,
    local_host: config.image_local_host,
    local_port: config.image_local_port,
    local_model: config.image_local_model,
    local_api_key: config.image_local_api_key,
    cloud_provider: config.image_cloud_provider,
    cloud_api_key: config.image_cloud_api_key,
    cloud_model: config.image_cloud_model,
    cloud_api_endpoint: config.image_cloud_api_endpoint,
    image_size: config.image_size,
  }
}

export function buildImageModelRequest(config = {}, { refresh = false } = {}) {
  if (config.image_mode === 'cloud') {
    return {
      mode: config.image_mode,
      local_host: config.image_local_host,
      local_port: config.image_local_port,
      local_api_key: config.image_local_api_key,
      cloud_provider: config.image_cloud_provider,
      cloud_api_key: config.image_cloud_api_key,
      cloud_api_endpoint: config.image_cloud_api_endpoint,
      refresh,
    }
  }

  return {
    mode: config.image_mode,
    local_host: config.image_local_host,
    local_port: config.image_local_port,
    local_api_key: config.image_local_api_key,
    refresh,
  }
}

export function buildImageEmbeddingPayload(config = {}) {
  const payload = {
    rag_enabled: true,
    image_embedding_provider_mode: config.image_mode,
    image_embedding_image_size: config.image_size,
    image_embedding_rps: config.image_rps,
    image_embedding_concurrency: config.image_concurrency,
    image_embedding_batch_size: config.image_batch_size,
    image_embedding_cache_ttl_hours: config.image_cache_ttl_hours,
    image_embedding_cache_max_mb: config.image_cache_max_mb,
  }

  if (config.image_mode === 'separate_local') {
    payload.image_embedding_local_host = config.image_local_host
    payload.image_embedding_local_port = config.image_local_port
    payload.image_embedding_local_model = config.image_local_model
    payload.image_embedding_local_api_key = config.image_local_api_key
    payload.image_embedding_local_timeout_ms = config.image_local_timeout_ms
    payload.image_embedding_cloud_provider = ''
    payload.image_embedding_cloud_api_key = ''
    payload.image_embedding_cloud_model = ''
    payload.image_embedding_cloud_api_endpoint = ''
  } else if (config.image_mode === 'cloud') {
    payload.image_embedding_cloud_provider = config.image_cloud_provider
    payload.image_embedding_cloud_api_key = config.image_cloud_api_key
    payload.image_embedding_cloud_model = config.image_cloud_model
    payload.image_embedding_cloud_api_endpoint = config.image_cloud_api_endpoint
    payload.image_embedding_local_api_key = ''
  } else {
    payload.image_embedding_local_api_key = ''
    payload.image_embedding_cloud_provider = ''
    payload.image_embedding_cloud_api_key = ''
    payload.image_embedding_cloud_model = ''
    payload.image_embedding_cloud_api_endpoint = ''
  }

  return payload
}

export function getImageConfigSignature(config = {}) {
  return [
    config.image_mode,
    config.image_cloud_provider,
    config.image_local_model,
    config.image_cloud_model,
  ].join('|')
}

export function getOriginalImageConfigSignature(originalConfig = {}) {
  if (!originalConfig?.image_mode) return ''
  return getImageConfigSignature(originalConfig)
}

export function getLocalImageModelsCacheKey(config = {}) {
  const host = (config.image_local_host || '').trim()
  const port = Number(config.image_local_port || 8000)
  if (!host) return null
  return `classifarr:image-models:local:${host}:${port}`
}

export function getCloudImageModelsCacheKey(config = {}) {
  const provider = (config.image_cloud_provider || '').trim()
  if (!provider) return null
  const endpoint = (config.image_cloud_api_endpoint || '').trim()
  return `classifarr:image-models:cloud:${provider}:${endpoint}`
}

export function readImageModelsCache(storage, key) {
  if (!storage || !key) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.models)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeImageModelsCache(storage, key, models) {
  if (!storage || !key) return
  try {
    storage.setItem(key, JSON.stringify({
      models,
      fetchedAt: new Date().toISOString(),
    }))
  } catch {
    // Best-effort cache only
  }
}

export function isImageModelsCacheStale(fetchedAt, cacheTtlMs) {
  if (!fetchedAt) return true
  const timestamp = new Date(fetchedAt).getTime()
  if (!Number.isFinite(timestamp)) return true
  return (Date.now() - timestamp) > cacheTtlMs
}
