/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export function normalizeImageEmbeddingMode(rawMode) {
  if (rawMode === 'local') return 'separate_local'
  return ['disabled', 'separate_local', 'cloud'].includes(rawMode) ? rawMode : 'disabled'
}

export function normalizeOverviewRagConfig(data = {}) {
  return {
    primary_provider: data.primary_provider || 'none',
    mode: data.embedding_provider_mode || 'same',
    embedding_model: data.embedding_model || 'nomic-embed-text',
    ollama_model: data.embedding_ollama_model || 'nomic-embed-text',
    cloud_provider: data.embedding_cloud_provider || '',
    cloud_model: data.embedding_cloud_model || '',
    rag_similarity_threshold: Number(data.rag_similarity_threshold ?? 0.7),
    rag_text_weight: Number(data.rag_text_weight ?? 0.7),
    rag_image_weight: Number(data.rag_image_weight ?? 0.3),
    rag_min_history_count: Number(data.rag_min_history_count ?? 50),
    image_mode: normalizeImageEmbeddingMode(data.image_embedding_provider_mode || 'disabled'),
    image_local_host: data.image_embedding_local_host || '',
    image_size: Number(data.image_embedding_image_size ?? 512),
    image_rps: Number(data.image_embedding_rps ?? 2),
    image_concurrency: Number(data.image_embedding_concurrency ?? 2),
  }
}

export function getOverviewTextProviderLabel(config = {}) {
  const mode = config.mode
  if (mode === 'cloud') {
    return config.cloud_provider || 'cloud'
  }
  if (mode === 'separate_ollama') {
    return 'ollama'
  }
  return config.primary_provider || 'classification'
}

export function getOverviewTextModelLabel(config = {}) {
  const mode = config.mode
  if (mode === 'cloud') {
    return config.cloud_model || 'default'
  }
  if (mode === 'separate_ollama') {
    return config.ollama_model || 'default'
  }
  return config.embedding_model || 'default'
}
