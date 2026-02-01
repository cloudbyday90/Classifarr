/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0
 */

// Mock axios before requiring the module
jest.mock('axios');
jest.mock('../config/database', () => ({
    query: jest.fn().mockResolvedValue({
        rows: [{ ollama_host: 'localhost', ollama_port: 11434 }]
    })
}));
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    })
}));

const axios = require('axios');
const ollamaService = require('../services/ollama');

describe('OllamaService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset service state
        ollamaService.host = null;
        ollamaService.port = null;
        ollamaService.baseUrl = null;
    });

    describe('getLoadedModels', () => {
        it('should return list of currently loaded models', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [
                        { name: 'gemma3:12b', size: 8589934592, digest: 'abc123' },
                        { name: 'nomic-embed-text', size: 274877440, digest: 'def456' }
                    ]
                }
            });

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(axios.get).toHaveBeenCalledWith(
                'http://localhost:11434/api/ps',
                { timeout: 5000 }
            );
            expect(models).toHaveLength(2);
            expect(models[0].name).toBe('gemma3:12b');
        });

        it('should return empty array when no models loaded', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toHaveLength(0);
        });

        it('should return empty array on error (non-fatal)', async () => {
            axios.get.mockRejectedValueOnce(new Error('Connection refused'));

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toEqual([]);
        });
    });

    describe('isModelLoaded', () => {
        it('should return true when model is loaded (exact match)', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'gemma3:12b' }]
                }
            });

            const isLoaded = await ollamaService.isModelLoaded('gemma3:12b', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return true when model matches with tag suffix', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'gemma3:12b' }]
                }
            });

            const isLoaded = await ollamaService.isModelLoaded('gemma3', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return false when model is not loaded', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'gemma3:12b' }]
                }
            });

            const isLoaded = await ollamaService.isModelLoaded('llama3', 'localhost', 11434);

            expect(isLoaded).toBe(false);
        });

        it('should return false when no models are loaded', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            const isLoaded = await ollamaService.isModelLoaded('gemma3:12b', 'localhost', 11434);

            expect(isLoaded).toBe(false);
        });
    });

    describe('embed with keep_alive', () => {
        it('should pass keep_alive parameter in embed request', async () => {
            // Mock getModels for model check
            axios.get.mockResolvedValueOnce({
                data: { models: [{ name: 'nomic-embed-text' }] }
            });
            // Mock embed request
            axios.post.mockResolvedValueOnce({
                data: { embeddings: [[0.1, 0.2, 0.3]] }
            });

            await ollamaService.embed('test text', 'nomic-embed-text', '15m');

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/api/embed'),
                expect.objectContaining({
                    model: 'nomic-embed-text',
                    input: 'test text',
                    keep_alive: '15m'
                }),
                expect.any(Object)
            );
        });

        it('should use default keep_alive of 5m', async () => {
            axios.get.mockResolvedValueOnce({
                data: { models: [{ name: 'nomic-embed-text' }] }
            });
            axios.post.mockResolvedValueOnce({
                data: { embeddings: [[0.1, 0.2, 0.3]] }
            });

            await ollamaService.embed('test text', 'nomic-embed-text');

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ keep_alive: '5m' }),
                expect.any(Object)
            );
        });
    });
});
