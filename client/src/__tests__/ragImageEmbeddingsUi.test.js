/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'

import {
  buildImageModelOptions,
  DEFAULT_IMAGE_MODEL_OPTIONS,
  getImageModelDimsLabel,
  getSelectedImageModelName,
} from '@/utils/ragImageEmbeddingsUi'

describe('ragImageEmbeddingsUi utility helpers', () => {
  it('builds model options from live models and preserves the current selection when missing', () => {
    expect(buildImageModelOptions([
      { id: 'ViT-L-14', name: 'ViT-L-14', dims: 768 },
    ], { currentModel: 'ViT-B-16' })).toEqual([
      { name: 'ViT-B-16', description: 'Current selection' },
      { name: 'ViT-L-14', description: 'ViT-L-14', dims: 768 },
    ])
  })

  it('falls back to the default model catalog when no live models exist', () => {
    expect(buildImageModelOptions([], { currentModel: 'ViT-B-16' })).toEqual([
      ...DEFAULT_IMAGE_MODEL_OPTIONS,
    ])
  })

  it('selects the active image model name for local and cloud modes', () => {
    expect(getSelectedImageModelName({ image_mode: 'separate_local', image_local_model: 'ViT-B-16' })).toBe('ViT-B-16')
    expect(getSelectedImageModelName({ image_mode: 'cloud', image_cloud_model: 'voyage-multimodal-3' })).toBe('voyage-multimodal-3')
  })

  it('derives the displayed model dimensions from live or fallback options', () => {
    expect(getImageModelDimsLabel({
      config: { image_mode: 'separate_local', image_local_model: 'ViT-L-14' },
      models: [{ id: 'ViT-L-14', name: 'ViT-L-14', dims: 768 }],
    })).toBe('768')

    expect(getImageModelDimsLabel({
      config: { image_mode: 'separate_local', image_local_model: 'ViT-B-32' },
      models: [],
    })).toBe('512')

    expect(getImageModelDimsLabel({
      config: { image_mode: 'cloud', image_cloud_model: 'unknown' },
      models: [],
    })).toBe('n/a')
  })
})