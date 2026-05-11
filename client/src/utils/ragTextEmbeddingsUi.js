export function normalizeTextEmbeddingConfig(data = {}) {
  return {
    primary_provider: data.primary_provider || 'none',
    mode: data.embedding_provider_mode || 'same',
    embedding_model: data.embedding_model || 'nomic-embed-text',
    ollama_host: data.embedding_ollama_host || '',
    ollama_port: data.embedding_ollama_port || 11434,
    ollama_model: data.embedding_ollama_model || 'nomic-embed-text',
    cloud_provider: data.embedding_cloud_provider || '',
    cloud_api_key: data.embedding_cloud_api_key || '',
    cloud_model: data.embedding_cloud_model || '',
  }
}

export function getSelectedTextModelName(config = {}) {
  if (config.mode === 'cloud') return config.cloud_model
  if (config.mode === 'separate_ollama') return config.ollama_model
  return config.embedding_model
}

export function getTextProviderLabel(config = {}) {
  if (config.mode === 'cloud') return config.cloud_provider || 'cloud'
  if (config.mode === 'separate_ollama') return 'ollama'
  return config.primary_provider || 'classification'
}

export function isTextProviderConfigured(config = {}) {
  if (config.mode === 'same') {
    return !!config.primary_provider && config.primary_provider !== 'none'
  }
  if (config.mode === 'separate_ollama') {
    return !!config.ollama_host
  }
  if (config.mode === 'cloud') {
    return !!config.cloud_api_key
  }
  return false
}

export function buildTextConnectionRequest(config = {}) {
  return {
    mode: config.mode,
    host: config.ollama_host,
    port: config.ollama_port,
    model: config.mode === 'same' ? config.embedding_model : config.ollama_model,
  }
}

export function buildTextModelRequest(config = {}, overrides = {}) {
  const nextMode = overrides.mode || config.mode || 'same'
  return {
    mode: nextMode,
    provider: overrides.provider ?? (nextMode === 'cloud' ? config.cloud_provider : undefined),
    api_key: overrides.api_key ?? (nextMode === 'cloud' ? config.cloud_api_key : undefined),
  }
}

export function toRecommendedTextModelOption(model = {}) {
  return {
    id: model.id || model.name || '',
    name: model.name || model.id || '',
    description: model.desc || model.description || model.name || model.id || 'Recommended embedding model',
    dims: model.dims ?? null,
  }
}

export function mergeConfiguredTextModels(models = [], config = {}) {
  const merged = [...models]
  const selectedModels = [config.embedding_model, config.ollama_model].filter(Boolean)

  for (const selected of selectedModels) {
    if (!merged.find((model) => model.id === selected)) {
      merged.unshift({
        id: selected,
        name: selected,
        description: 'Configured model',
        dims: null,
      })
    }
  }

  return merged
}

export function buildTextEmbeddingPayload(config = {}) {
  const payload = {
    rag_enabled: true,
    embedding_provider_mode: config.mode,
    embedding_model: config.embedding_model,
    embedding_ollama_host: config.ollama_host,
    embedding_ollama_port: config.ollama_port,
    embedding_ollama_model: config.ollama_model,
  }

  if (config.mode === 'cloud') {
    payload.embedding_cloud_provider = config.cloud_provider
    payload.embedding_cloud_api_key = config.cloud_api_key
    payload.embedding_cloud_model = config.cloud_model
  } else {
    payload.embedding_cloud_provider = ''
    payload.embedding_cloud_api_key = ''
    payload.embedding_cloud_model = ''
  }

  return payload
}

export function getTextConfigSignature(config = {}) {
  return [
    config.mode,
    config.cloud_provider,
    getSelectedTextModelName(config),
  ].join('|')
}

export function getOriginalTextConfigSignature(originalConfig = {}) {
  if (!originalConfig?.mode) return ''
  return getTextConfigSignature(originalConfig)
}
