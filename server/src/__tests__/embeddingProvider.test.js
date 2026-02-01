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

// Mock database
jest.mock('../config/database');

// Mock ollama service  
jest.mock('../services/ollama');

// Mock logger
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock axios for cloud provider tests
const mockAxios = {
    post: jest.fn()
};
jest.mock('axios', () => mockAxios);

// Import modules after mocks are set up
const db = require('../config/database');
const ollamaService = require('../services/ollama');
const embeddingProvider = require('../services/embeddingProvider');

describe('EmbeddingProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        embeddingProvider.resetConfig();
        embeddingProvider.resetMetrics();
    });

    describe('getConfig', () => {
        it('should return config from database', async () => {
            const mockConfig = {
                embedding_provider_mode: 'same',
                embedding_ollama_host: null,
                embedding_ollama_port: 11434,
                embedding_ollama_model: null,
                embedding_cloud_provider: null,
                embedding_cloud_api_key: null,
                embedding_cloud_model: null,
                primary_provider: 'ollama',
                ollama_host: 'localhost',
                ollama_port: 11434,
                embedding_model: 'nomic-embed-text-v2-moe'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });

            const config = await embeddingProvider.getConfig();

            expect(config).toEqual(mockConfig);
        });

        it('should return null if no config exists', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const config = await embeddingProvider.getConfig();

            expect(config).toBeNull();
        });
    });

    describe('getEmbedding - same mode', () => {
        it('should use classification Ollama when mode is same', async () => {
            const mockConfig = {
                embedding_provider_mode: 'same',
                primary_provider: 'ollama',
                ollama_host: 'localhost',
                ollama_port: 11434,
                embedding_model: 'nomic-embed-text-v2-moe'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            ollamaService.embed.mockResolvedValue({
                embedding: [0.1, 0.2, 0.3],
                dims: 3
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(ollamaService.embed).toHaveBeenCalledWith('test text', 'nomic-embed-text-v2-moe', '15m');
            expect(result).toEqual({
                embedding: [0.1, 0.2, 0.3],
                dims: 3,
                provider: 'ollama',
                model: 'nomic-embed-text-v2-moe',
                cost: 0
            });
        });
    });

    describe('getEmbedding - separate_ollama mode', () => {
        it('should use separate Ollama instance', async () => {
            const mockConfig = {
                embedding_provider_mode: 'separate_ollama',
                embedding_ollama_host: '192.168.1.100',
                embedding_ollama_port: 11435,
                embedding_ollama_model: 'mxbai-embed-large'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: {
                    embeddings: [[0.4, 0.5, 0.6]]
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://192.168.1.100:11435/api/embed',
                {
                    model: 'mxbai-embed-large',
                    input: 'test text'
                },
                { timeout: 120000 }
            );
            expect(result.provider).toBe('ollama');
            expect(result.dims).toBe(3);
            expect(result.cost).toBe(0);
        });
    });

    describe('getEmbedding - cloud mode', () => {
        it('should use OpenAI for cloud embeddings', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'openai',
                embedding_cloud_api_key: 'sk-test-key',
                embedding_cloud_model: 'text-embedding-3-small'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: {
                    data: [{
                        embedding: [0.7, 0.8, 0.9]
                    }],
                    usage: {
                        total_tokens: 100
                    }
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://api.openai.com/v1/embeddings',
                {
                    input: 'test text',
                    model: 'text-embedding-3-small'
                },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer sk-test-key'
                    })
                })
            );
            expect(result.provider).toBe('openai');
            expect(result.dims).toBe(3);
            expect(result.cost).toBeGreaterThan(0);
        });

        it('should use Gemini for cloud embeddings', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'gemini',
                embedding_cloud_api_key: 'gemini-api-key',
                embedding_cloud_model: 'text-embedding-004'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: {
                    embedding: {
                        values: [0.1, 0.2, 0.3, 0.4]
                    }
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://generativelanguage.googleapis.com/v1/models/text-embedding-004:embedContent?key=gemini-api-key',
                {
                    content: {
                        parts: [{ text: 'test text' }]
                    }
                },
                expect.any(Object)
            );
            expect(result.provider).toBe('gemini');
            expect(result.dims).toBe(4);
        });

        it('should use Voyage for cloud embeddings', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'voyage',
                embedding_cloud_api_key: 'voyage-key',
                embedding_cloud_model: 'voyage-2'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: {
                    data: [{
                        embedding: [0.5, 0.6]
                    }],
                    usage: { total_tokens: 50 }
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://api.voyageai.com/v1/embeddings',
                {
                    input: 'test text',
                    model: 'voyage-2'
                },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer voyage-key'
                    })
                })
            );
            expect(result.provider).toBe('voyage');
        });

        it('should use Cohere for cloud embeddings', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'cohere',
                embedding_cloud_api_key: 'cohere-key',
                embedding_cloud_model: 'embed-english-v3.0'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: {
                    embeddings: [[0.3, 0.4, 0.5]]
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://api.cohere.ai/v1/embed',
                {
                    texts: ['test text'],
                    model: 'embed-english-v3.0',
                    input_type: 'search_document'
                },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer cohere-key'
                    })
                })
            );
            expect(result.provider).toBe('cohere');
            expect(result.dims).toBe(3);
        });

        it('should throw error for unknown cloud provider', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'unknown',
                embedding_cloud_api_key: 'key',
                embedding_cloud_model: 'model'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });

            await expect(embeddingProvider.getEmbedding('test text')).rejects.toThrow('Unknown cloud provider');
        });

        it('should throw error when API key is missing', async () => {
            const mockConfig = {
                embedding_provider_mode: 'cloud',
                embedding_cloud_provider: 'openai',
                embedding_cloud_api_key: null,
                embedding_cloud_model: 'text-embedding-3-small'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });

            await expect(embeddingProvider.getEmbedding('test text')).rejects.toThrow('No API key configured');
        });
    });

    describe('testConnection', () => {
        it('should test connection successfully', async () => {
            const mockConfig = {
                embedding_provider_mode: 'same',
                primary_provider: 'ollama',
                ollama_host: 'localhost',
                ollama_port: 11434,
                embedding_model: 'nomic-embed-text-v2-moe'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            ollamaService.embed.mockResolvedValue({
                embedding: [0.1, 0.2, 0.3],
                dims: 3
            });

            const result = await embeddingProvider.testConnection();

            expect(result.success).toBe(true);
            expect(result.dimensions).toBe(3);
            expect(result.provider).toBe('ollama');
        });

        it('should return error on test failure', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const result = await embeddingProvider.testConnection();

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('getProviderDefaults', () => {
        it('should return provider defaults', () => {
            const defaults = embeddingProvider.getProviderDefaults();

            expect(defaults).toHaveProperty('openai');
            expect(defaults).toHaveProperty('gemini');
            expect(defaults).toHaveProperty('voyage');
            expect(defaults).toHaveProperty('openrouter');
            expect(defaults).toHaveProperty('cohere');
            expect(defaults.openai.default).toBe('text-embedding-3-small');
            expect(defaults.gemini.default).toBe('text-embedding-004');
        });
    });

    describe('edge cases', () => {
        it('should throw error for empty text', async () => {
            await expect(embeddingProvider.getEmbedding('')).rejects.toThrow('Cannot embed empty text');
        });

        it('should throw error when no config found', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await expect(embeddingProvider.getEmbedding('test')).rejects.toThrow('No embedding provider configuration found');
        });
    });

    // Regression tests for v0.38.5-alpha fixes
    describe('Ollama API endpoint format (v0.38.5 regression)', () => {
        it('should use /api/embed endpoint (not deprecated /api/embeddings)', async () => {
            const mockConfig = {
                embedding_provider_mode: 'separate_ollama',
                embedding_ollama_host: '192.168.1.100',
                embedding_ollama_port: 11434,
                embedding_ollama_model: 'nomic-embed-text'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: { embeddings: [[0.1, 0.2]] }
            });

            await embeddingProvider.getEmbedding('test');

            // Verify /api/embed endpoint is called (not /api/embeddings)
            expect(mockAxios.post).toHaveBeenCalledWith(
                expect.stringContaining('/api/embed'),
                expect.any(Object),
                expect.any(Object)
            );
            // Verify it does NOT contain /api/embeddings
            expect(mockAxios.post).not.toHaveBeenCalledWith(
                expect.stringContaining('/api/embeddings'),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should use input parameter (not deprecated prompt)', async () => {
            const mockConfig = {
                embedding_provider_mode: 'separate_ollama',
                embedding_ollama_host: 'localhost',
                embedding_ollama_port: 11434,
                embedding_ollama_model: 'nomic-embed-text'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            mockAxios.post.mockResolvedValue({
                data: { embeddings: [[0.1]] }
            });

            await embeddingProvider.getEmbedding('test text');

            // Verify request body uses 'input' not 'prompt'
            expect(mockAxios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ input: 'test text' }),
                expect.any(Object)
            );
        });

        it('should handle embeddings array response format', async () => {
            const mockConfig = {
                embedding_provider_mode: 'separate_ollama',
                embedding_ollama_host: 'localhost',
                embedding_ollama_port: 11434,
                embedding_ollama_model: 'mxbai-embed-large'
            };

            db.query.mockResolvedValue({ rows: [mockConfig] });
            // New format: embeddings array
            mockAxios.post.mockResolvedValue({
                data: { embeddings: [[0.5, 0.6, 0.7]] }
            });

            const result = await embeddingProvider.getEmbedding('test');

            expect(result.embedding).toEqual([0.5, 0.6, 0.7]);
            expect(result.dims).toBe(3);
        });
    });

    // v0.39.3-alpha: Tests for ConfigurationError and circuit breaker behavior
    describe('v0.39.3-alpha Configuration Error Handling', () => {
        describe('ConfigurationError for missing cloud provider', () => {
            it('should throw ConfigurationError when cloud mode has no provider configured', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'cloud',
                    embedding_cloud_provider: null, // Missing!
                    embedding_cloud_api_key: 'test-key',
                    embedding_cloud_model: 'test-model'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No cloud embedding provider configured');
            });

            it('should throw ConfigurationError when cloud mode has no API key', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'cloud',
                    embedding_cloud_provider: 'openai',
                    embedding_cloud_api_key: null, // Missing!
                    embedding_cloud_model: 'text-embedding-3-small'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No API key configured for openai');
            });
        });

        describe('ConfigurationError for missing same mode configuration', () => {
            it('should throw ConfigurationError when same mode has no AI provider', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'same',
                    primary_provider: 'none', // Not configured!
                    embedding_model: 'nomic-embed-text'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No AI provider configured for embedding generation');
            });

            it('should throw ConfigurationError when same mode has null primary_provider', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'same',
                    primary_provider: null, // Not configured!
                    embedding_model: 'nomic-embed-text'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No AI provider configured for embedding generation');
            });
        });

        describe('ConfigurationError for missing separate_ollama configuration', () => {
            it('should throw ConfigurationError when separate_ollama has no host', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'separate_ollama',
                    embedding_ollama_host: null, // Missing!
                    embedding_ollama_port: 11434,
                    embedding_ollama_model: 'nomic-embed-text'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No separate Ollama host configured');
            });

            it('should throw ConfigurationError when separate_ollama has empty host', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'separate_ollama',
                    embedding_ollama_host: '', // Empty!
                    embedding_ollama_port: 11434,
                    embedding_ollama_model: 'nomic-embed-text'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                await expect(embeddingProvider.getEmbedding('test text'))
                    .rejects
                    .toThrow('No separate Ollama host configured');
            });
        });

        describe('ConfigurationError properties', () => {
            it('should mark ConfigurationError with isConfigurationError flag', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'cloud',
                    embedding_cloud_provider: null,
                    embedding_cloud_api_key: 'key'
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                try {
                    await embeddingProvider.getEmbedding('test text');
                    fail('Should have thrown');
                } catch (error) {
                    expect(error.isConfigurationError).toBe(true);
                    expect(error.name).toBe('ConfigurationError');
                }
            });
        });

        describe('Circuit breaker should not trip on ConfigurationError', () => {
            it('should not trip circuit breaker on configuration errors', async () => {
                const mockConfig = {
                    embedding_provider_mode: 'cloud',
                    embedding_cloud_provider: null
                };

                db.query.mockResolvedValue({ rows: [mockConfig] });

                // Try to trigger an error multiple times
                for (let i = 0; i < 10; i++) {
                    try {
                        await embeddingProvider.getEmbedding('test text');
                    } catch (error) {
                        // Expected to throw
                    }
                }

                // Circuit breaker should still allow requests
                const status = embeddingProvider.circuitBreaker.getStatus();
                expect(status.state).not.toBe('OPEN');
            });
        });
    });
});
