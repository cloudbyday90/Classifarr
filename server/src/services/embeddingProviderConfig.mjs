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

export const SAME_MODE_DEFAULTS = {
    ollama: 'nomic-embed-text-v2-moe',
    openai: 'text-embedding-3-small',
    gemini: 'text-embedding-005',
    openrouter: 'text-embedding-3-small',
    litellm: 'text-embedding-3-small',
    custom: 'text-embedding-3-small'
};

export const RECOMMENDED_EMBEDDING_MODELS = {
    ollama: [
        { id: 'nomic-embed-text', name: 'Nomic Embed Text', dims: 768, recommended: true, desc: 'High-performing open embedding model with large context window' },
        { id: 'mxbai-embed-large', name: 'MxBai Embed Large', dims: 1024, recommended: true, desc: 'State-of-the-art large embedding model from mixedbread.ai' },
        { id: 'bge-m3', name: 'BGE-M3', dims: 1024, desc: 'Multi-Functionality, Multi-Linguality, Multi-Granularity model from BAAI' },
        { id: 'all-minilm', name: 'All-MiniLM', dims: 384, desc: 'Fast, lightweight model for sentence embeddings' },
        { id: 'snowflake-arctic-embed', name: 'Snowflake Arctic Embed', dims: 1024, desc: 'Suite of text embedding models optimized for performance' },
        { id: 'snowflake-arctic-embed2', name: 'Snowflake Arctic Embed 2', dims: 1024, desc: 'Multilingual support without sacrificing English performance' },
        { id: 'nomic-embed-text-v2-moe', name: 'Nomic Embed v2 MoE', dims: 768, desc: 'Multilingual MoE text embedding model' },
        { id: 'bge-large', name: 'BGE Large', dims: 1024, desc: 'Embedding model from BAAI mapping texts to vectors' },
        { id: 'qwen3-embedding', name: 'Qwen3 Embedding', dims: 1024, desc: 'Text embeddings from Qwen3 series in various sizes' },
        { id: 'granite-embedding', name: 'Granite Embedding', dims: 768, desc: 'IBM Granite multilingual text embedding model' },
        { id: 'embeddinggemma', name: 'EmbeddingGemma', dims: 768, desc: '300M parameter embedding model from Google' },
        { id: 'paraphrase-multilingual', name: 'Paraphrase Multilingual', dims: 768, desc: 'Sentence-transformers model for clustering or semantic search' }
    ],
    openai: [
        { id: 'text-embedding-3-small', name: 'Embedding 3 Small', dims: 1536, recommended: true, desc: 'Cost-effective, efficient for most use cases' },
        { id: 'text-embedding-3-large', name: 'Embedding 3 Large', dims: 3072, desc: 'Highest quality for demanding applications' },
        { id: 'text-embedding-ada-002', name: 'Ada 002', dims: 1536, desc: 'Previous generation, widely supported' }
    ],
    gemini: [
        { id: 'text-embedding-005', name: 'Text Embedding 005', dims: 768, recommended: true, desc: 'Latest Gemini embedding model' },
        { id: 'text-embedding-004', name: 'Text Embedding 004', dims: 768, desc: 'Previous Gemini embedding model' }
    ]
};

export class ConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigurationError';
        this.isConfigurationError = true;
    }
}

export const PROVIDER_DEFAULTS = {
    openai: {
        models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
        default: 'text-embedding-3-small',
        dimensions: {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536
        },
        pricing: {
            'text-embedding-3-small': 0.02,
            'text-embedding-3-large': 0.13,
            'text-embedding-ada-002': 0.02
        }
    },
    gemini: {
        models: ['text-embedding-004', 'embedding-001'],
        default: 'text-embedding-004',
        dimensions: {
            'text-embedding-004': 768,
            'embedding-001': 768
        },
        pricing: {
            'text-embedding-004': 0.025,
            'embedding-001': 0.025
        }
    },
    voyage: {
        models: ['voyage-2', 'voyage-large-2', 'voyage-code-2'],
        default: 'voyage-2',
        dimensions: {
            'voyage-2': 1024,
            'voyage-large-2': 1536,
            'voyage-code-2': 1536
        },
        pricing: {
            'voyage-2': 0.012,
            'voyage-large-2': 0.012,
            'voyage-code-2': 0.012
        }
    },
    openrouter: {
        models: ['openai/text-embedding-3-small', 'openai/text-embedding-3-large'],
        default: 'openai/text-embedding-3-small',
        dimensions: {
            'openai/text-embedding-3-small': 1536,
            'openai/text-embedding-3-large': 3072
        },
        pricing: {
            'openai/text-embedding-3-small': 0.02,
            'openai/text-embedding-3-large': 0.13
        }
    },
    cohere: {
        models: ['embed-english-v3.0', 'embed-multilingual-v3.0', 'embed-english-light-v3.0'],
        default: 'embed-english-v3.0',
        dimensions: {
            'embed-english-v3.0': 1024,
            'embed-multilingual-v3.0': 1024,
            'embed-english-light-v3.0': 384
        },
        pricing: {
            'embed-english-v3.0': 0.10,
            'embed-multilingual-v3.0': 0.10,
            'embed-english-light-v3.0': 0.10
        }
    }
};
