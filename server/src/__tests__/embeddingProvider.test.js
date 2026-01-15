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

            expect(ollamaService.embed).toHaveBeenCalledWith('test text', 'nomic-embed-text-v2-moe');
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
                    embedding: [0.4, 0.5, 0.6]
                }
            });

            const result = await embeddingProvider.getEmbedding('test text');

            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://192.168.1.100:11435/api/embeddings',
                {
                    model: 'mxbai-embed-large',
                    prompt: 'test text'
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
});
