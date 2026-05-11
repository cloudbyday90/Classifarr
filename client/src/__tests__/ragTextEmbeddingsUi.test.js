/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  buildTextConnectionRequest,
  buildTextEmbeddingPayload,
  buildTextModelRequest,
  getOriginalTextConfigSignature,
  getSelectedTextModelName,
  getTextConfigSignature,
  getTextProviderLabel,
  isTextProviderConfigured,
  mergeConfiguredTextModels,
  normalizeTextEmbeddingConfig,
  toRecommendedTextModelOption,
} from '@/utils/ragTextEmbeddingsUi'

describe('ragTextEmbeddingsUi utility helpers', () => {
  it('normalizes server config into the client text embedding shape', () => {
    expect(normalizeTextEmbeddingConfig({
      primary_provider: 'openai',
      embedding_provider_mode: 'cloud',
      embedding_model: 'text-embedding-3-small',
      embedding_ollama_host: 'localhost',
      embedding_ollama_port: 11434,
      embedding_ollama_model: 'nomic-embed-text',
      embedding_cloud_provider: 'openai',
      embedding_cloud_api_key: 'cloud-key',
      embedding_cloud_model: 'text-embedding-3-large',
    })).toEqual({
      primary_provider: 'openai',
      mode: 'cloud',
      embedding_model: 'text-embedding-3-small',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'nomic-embed-text',
      cloud_provider: 'openai',
      cloud_api_key: 'cloud-key',
      cloud_model: 'text-embedding-3-large',
    })
  })

  it('derives selected model names, provider labels, and configured state by mode', () => {
    expect(getSelectedTextModelName({ mode: 'same', embedding_model: 'text-embedding-3-small' })).toBe('text-embedding-3-small')
    expect(getSelectedTextModelName({ mode: 'separate_ollama', ollama_model: 'nomic-embed-text' })).toBe('nomic-embed-text')
    expect(getSelectedTextModelName({ mode: 'cloud', cloud_model: 'text-embedding-3-large' })).toBe('text-embedding-3-large')

    expect(getTextProviderLabel({ mode: 'same', primary_provider: 'openai' })).toBe('openai')
    expect(getTextProviderLabel({ mode: 'separate_ollama' })).toBe('ollama')
    expect(getTextProviderLabel({ mode: 'cloud', cloud_provider: 'voyage' })).toBe('voyage')

    expect(isTextProviderConfigured({ mode: 'same', primary_provider: 'openai' })).toBe(true)
    expect(isTextProviderConfigured({ mode: 'separate_ollama', ollama_host: 'localhost' })).toBe(true)
    expect(isTextProviderConfigured({ mode: 'cloud', cloud_api_key: 'secret' })).toBe(true)
    expect(isTextProviderConfigured({ mode: 'cloud', cloud_api_key: '' })).toBe(false)
  })

  it('builds connection and model requests for the current mode', () => {
    expect(buildTextConnectionRequest({
      mode: 'same',
      ollama_host: 'localhost',
      ollama_port: 11434,
      embedding_model: 'text-embedding-3-small',
      ollama_model: 'nomic-embed-text',
    })).toEqual({
      mode: 'same',
      host: 'localhost',
      port: 11434,
      model: 'text-embedding-3-small',
    })

    expect(buildTextConnectionRequest({
      mode: 'cloud',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'nomic-embed-text',
    })).toEqual({
      mode: 'cloud',
      host: 'localhost',
      port: 11434,
      model: 'nomic-embed-text',
    })

    expect(buildTextModelRequest({
      mode: 'cloud',
      cloud_provider: 'openai',
      cloud_api_key: 'cloud-key',
    })).toEqual({
      mode: 'cloud',
      provider: 'openai',
      api_key: 'cloud-key',
    })

    expect(buildTextModelRequest({ mode: 'same' }, { mode: 'separate_ollama' })).toEqual({
      mode: 'separate_ollama',
      provider: undefined,
      api_key: undefined,
    })
  })

  it('normalizes recommended models and merges configured models without dropping the current selection', () => {
    expect(toRecommendedTextModelOption({
      name: 'text-embedding-3-large',
      desc: 'Large model',
      dims: 3072,
    })).toEqual({
      id: 'text-embedding-3-large',
      name: 'text-embedding-3-large',
      description: 'Large model',
      dims: 3072,
    })

    expect(mergeConfiguredTextModels([
      { id: 'text-embedding-3-large', description: 'Large model', dims: 3072 },
    ], {
      embedding_model: 'text-embedding-3-small',
      ollama_model: 'nomic-embed-text',
    })).toEqual([
      { id: 'nomic-embed-text', name: 'nomic-embed-text', description: 'Configured model', dims: null },
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small', description: 'Configured model', dims: null },
      { id: 'text-embedding-3-large', description: 'Large model', dims: 3072 },
    ])
  })

  it('builds payloads and config signatures using the current embedding mode', () => {
    const config = {
      mode: 'cloud',
      embedding_model: 'text-embedding-3-small',
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'nomic-embed-text',
      cloud_provider: 'openai',
      cloud_api_key: 'cloud-key',
      cloud_model: 'text-embedding-3-large',
    }

    expect(buildTextEmbeddingPayload(config)).toEqual({
      rag_enabled: true,
      embedding_provider_mode: 'cloud',
      embedding_model: 'text-embedding-3-small',
      embedding_ollama_host: 'localhost',
      embedding_ollama_port: 11434,
      embedding_ollama_model: 'nomic-embed-text',
      embedding_cloud_provider: 'openai',
      embedding_cloud_api_key: 'cloud-key',
      embedding_cloud_model: 'text-embedding-3-large',
    })

    expect(buildTextEmbeddingPayload({ ...config, mode: 'same' })).toEqual(expect.objectContaining({
      embedding_provider_mode: 'same',
      embedding_cloud_provider: '',
      embedding_cloud_api_key: '',
      embedding_cloud_model: '',
    }))

    expect(getTextConfigSignature(config)).toBe('cloud|openai|text-embedding-3-large')
    expect(getOriginalTextConfigSignature(config)).toBe('cloud|openai|text-embedding-3-large')
    expect(getOriginalTextConfigSignature({})).toBe('')
  })
})
