/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for AIRouterService
 */

import { jest } from '@jest/globals';
import { createNamedMockModule, createMockLogger } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn()
};
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockLogger = createMockLogger();
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

const mockCloudLLM = {
    checkBudget: jest.fn(),
    chat: jest.fn()
};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockOllamaService = {
    generate: jest.fn()
};
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllamaService));

describe('AIRouterService', () => {
    let service;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockDb.query.mockReset();
        mockCloudLLM.checkBudget.mockReset();
        mockCloudLLM.chat.mockReset();
        mockOllamaService.generate.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();

        jest.resetModules();
        ({ aiRouterService: service } = await import('../services/aiRouter.mjs'));
    });

    describe('getConfig', () => {
        it('should return cached config if within TTL', async () => {
            const mockConfig = {
                primary_provider: 'openai',
                ollama_fallback_enabled: true
            };
            mockDb.query.mockResolvedValue({
                rows: [mockConfig]
            });

            const config1 = await service.getConfig();
            const config2 = await service.getConfig();

            expect(mockDb.query).toHaveBeenCalledTimes(1);
            expect(config1).toEqual(mockConfig);
            expect(config2).toEqual(mockConfig);
        });

        it('should fetch new config after cache expires', async () => {
            const mockConfig = {
                primary_provider: 'openai',
                ollama_fallback_enabled: true
            };
            mockDb.query.mockResolvedValue({
                rows: [mockConfig]
            });

            await service.getConfig();
            service.clearCache();
            await service.getConfig();

            expect(mockDb.query).toHaveBeenCalledTimes(2);
        });

        it('should return default config when no rows found', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            const config = await service.getConfig();

            expect(config).toEqual({
                primary_provider: 'none',
                ollama_fallback_enabled: false
            });
        });

        it('should return default config on database error', async () => {
            mockDb.query.mockRejectedValue(new Error('Table not found'));

            const config = await service.getConfig();

            expect(config).toEqual({
                primary_provider: 'none',
                ollama_fallback_enabled: false
            });
        });
    });

    describe('clearCache', () => {
        it('should clear config cache', async () => {
            const mockConfig = {
                primary_provider: 'openai',
                ollama_fallback_enabled: true
            };
            mockDb.query.mockResolvedValue({
                rows: [mockConfig]
            });

            await service.getConfig();
            service.clearCache();
            await service.getConfig();

            expect(mockDb.query).toHaveBeenCalledTimes(2);
        });
    });

    describe('getProvider', () => {
        it('should return null when AI is disabled', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                }]
            });

            const provider = await service.getProvider('classification');

            expect(provider).toBeNull();
        });

        it('should use Ollama fallback when no primary provider', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'none',
                    ollama_fallback_enabled: true,
                    ollama_host: 'http://localhost:11434',
                    ollama_model: 'llama3.2'
                }]
            });

            const provider = await service.getProvider('classification');

            expect(provider).not.toBeNull();
            expect(provider.type).toBe('ollama');
            expect(provider.isCloud).toBe(false);
        });

        it('should return Ollama provider when primary is ollama', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama',
                    ollama_host: 'http://ollama:11434',
                    ollama_port: 11434,
                    ollama_model: 'llama3.2'
                }]
            });

            const provider = await service.getProvider('classification');

            expect(provider.type).toBe('ollama');
            expect(provider.config.host).toBe('http://ollama:11434');
            expect(provider.config.model).toBe('llama3.2');
        });

        it('should return cloud provider when configured', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    api_key: 'test-key',
                    model: 'gpt-4',
                    temperature: 0.7,
                    max_tokens: 1000
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: false,
                usage: 5.0,
                budget: 100.0
            });

            const provider = await service.getProvider('classification');

            expect(provider.type).toBe('openai');
            expect(provider.isCloud).toBe(true);
            expect(provider.config.model).toBe('gpt-4');
        });

        it('should fallback to Ollama when budget exhausted and fallback enabled', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    ollama_fallback_enabled: true,
                    ollama_for_budget_exhausted: true,
                    ollama_host: 'http://ollama:11434',
                    ollama_model: 'llama3.2'
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: true,
                shouldPause: true,
                usage: 100.0,
                budget: 100.0
            });

            const provider = await service.getProvider('classification');

            expect(provider.type).toBe('ollama');
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Falling back to Ollama due to budget exhaustion'
            );
        });

        it('should return null when budget exhausted without fallback', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    ollama_fallback_enabled: false,
                    ollama_for_budget_exhausted: false
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: true,
                shouldPause: true,
                usage: 100.0,
                budget: 100.0
            });

            const provider = await service.getProvider('classification');

            expect(provider).toBeNull();
        });

        it('should use Ollama for basic tasks when configured', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    ollama_fallback_enabled: true,
                    ollama_for_basic_tasks: true,
                    ollama_host: 'http://ollama:11434',
                    ollama_model: 'llama3.2'
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: false,
                usage: 5.0,
                budget: 100.0
            });

            const provider = await service.getProvider('basic');

            expect(provider.type).toBe('ollama');
        });
    });

    describe('getOllamaProvider', () => {
        it('should return Ollama provider config with defaults', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama'
                }]
            });

            const provider = await service.getProvider('classification');

            expect(provider.type).toBe('ollama');
            expect(provider.config.host).toBe('http://ollama:11434');
            expect(provider.config.port).toBe(11434);
            expect(provider.config.model).toBe('llama3.2');
        });

        it('should return Ollama provider config with custom values', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama',
                    ollama_host: 'http://custom-host:8080',
                    ollama_port: 8080,
                    ollama_model: 'custom-model'
                }]
            });

            const provider = await service.getProvider('classification');

            expect(provider.config.host).toBe('http://custom-host:8080');
            expect(provider.config.port).toBe(8080);
            expect(provider.config.model).toBe('custom-model');
        });
    });

    describe('isAvailable', () => {
        it('should return true when provider is configured', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama',
                    ollama_host: 'http://ollama:11434'
                }]
            });

            const available = await service.isAvailable();

            expect(available).toBe(true);
        });

        it('should return false when no provider configured', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                }]
            });

            const available = await service.isAvailable();

            expect(available).toBe(false);
        });

        it('should return false when budget exhausted', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    ollama_fallback_enabled: false
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: true,
                shouldPause: true,
                usage: 100.0,
                budget: 100.0
            });

            const available = await service.isAvailable();

            expect(available).toBe(false);
        });
    });

    describe('classify', () => {
        it('should throw error when no provider available', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                }]
            });

            await expect(service.classify('Test prompt')).rejects.toThrow(
                'AI is not available - no provider configured or budget exhausted'
            );
        });

        it('should use Ollama for classification', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama',
                    ollama_model: 'llama3.2'
                }]
            });

            mockOllamaService.generate.mockResolvedValue('Classification result');

            const result = await service.classify('Test prompt');

            expect(mockOllamaService.generate).toHaveBeenCalledWith('Test prompt', 'llama3.2');
            expect(result).toBe('Classification result');
        });

        it('should use cloud provider for classification', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    api_key: 'test-key',
                    model: 'gpt-4',
                    temperature: 0.7,
                    max_tokens: 1000
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: false,
                usage: 5.0,
                budget: 100.0
            });

            mockCloudLLM.chat.mockResolvedValue({
                content: 'Cloud classification result'
            });

            const result = await service.classify('Test prompt', {
                requestType: 'classification',
                itemTitle: 'Test Movie'
            });

            expect(mockCloudLLM.chat).toHaveBeenCalledWith(
                expect.arrayContaining([
                    { role: 'system', content: expect.any(String) },
                    { role: 'user', content: 'Test prompt' }
                ]),
                expect.objectContaining({ model: 'gpt-4' }),
                expect.objectContaining({ requestType: 'classification', itemTitle: 'Test Movie' })
            );
            expect(result).toBe('Cloud classification result');
        });
    });

    describe('getStatus', () => {
        it('should return status for Ollama provider', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'ollama',
                    ollama_fallback_enabled: true
                }]
            });

            const status = await service.getStatus();

            expect(status.configured).toBe(true);
            expect(status.primaryProvider).toBe('ollama');
            expect(status.activeProvider).toBe('ollama');
            expect(status.ollamaFallbackEnabled).toBe(true);
            expect(status.budgetInfo).toBeNull();
        });

        it('should return status for cloud provider with budget info', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'openai',
                    ollama_fallback_enabled: true
                }]
            });

            mockCloudLLM.checkBudget.mockResolvedValue({
                exhausted: false,
                usage: 25.0,
                budget: 100.0
            });

            const status = await service.getStatus();

            expect(status.configured).toBe(true);
            expect(status.primaryProvider).toBe('openai');
            expect(status.budgetInfo).not.toBeNull();
            expect(status.budgetInfo.usage).toBe(25.0);
        });

        it('should return status when no provider configured', async () => {
            mockDb.query.mockResolvedValue({
                rows: [{
                    primary_provider: 'none',
                    ollama_fallback_enabled: false
                }]
            });

            const status = await service.getStatus();

            expect(status.configured).toBe(false);
            expect(status.primaryProvider).toBe('none');
            expect(status.activeProvider).toBe('none');
        });
    });

    describe('checkAvailability', () => {
        let mockOllama;
        let mockCallerLogger;

        beforeEach(() => {
            mockOllama = { testConnection: jest.fn() };
            mockCallerLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        });

        it('returns false and logs transition when no provider configured', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'none', ollama_fallback_enabled: false }] });

            const result = await service.checkAvailability(true, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.info).toHaveBeenCalledWith('AI is disabled or no provider configured');
        });

        it('returns false silently when no provider and already unavailable', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'none', ollama_fallback_enabled: false }] });

            const result = await service.checkAvailability(false, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.info).not.toHaveBeenCalled();
        });

        it('returns true and logs recovery for cloud provider when previously unavailable', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'openai', ollama_fallback_enabled: false }] });
            mockCloudLLM.checkBudget.mockResolvedValue({ exhausted: false });

            const result = await service.checkAvailability(false, mockOllama, mockCallerLogger);

            expect(result).toBe(true);
            expect(mockCallerLogger.info).toHaveBeenCalledWith(expect.stringContaining('Cloud AI provider available'));
        });

        it('returns true silently for cloud provider when already available', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'openai', ollama_fallback_enabled: false }] });
            mockCloudLLM.checkBudget.mockResolvedValue({ exhausted: false });

            const result = await service.checkAvailability(true, mockOllama, mockCallerLogger);

            expect(result).toBe(true);
            expect(mockCallerLogger.info).not.toHaveBeenCalled();
        });

        it('returns true and logs recovery when Ollama probe succeeds and was unavailable', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'ollama', ollama_host: 'http://ollama:11434' }] });
            mockOllama.testConnection.mockResolvedValue({ success: true });

            const result = await service.checkAvailability(false, mockOllama, mockCallerLogger);

            expect(result).toBe(true);
            expect(mockCallerLogger.info).toHaveBeenCalledWith('Ollama is now available');
        });

        it('returns false and logs warning when Ollama probe fails and was available', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'ollama', ollama_host: 'http://ollama:11434' }] });
            mockOllama.testConnection.mockResolvedValue({ success: false, error: 'connection refused' });

            const result = await service.checkAvailability(true, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.warn).toHaveBeenCalledWith('Ollama is offline', { error: 'connection refused' });
        });

        it('returns false silently when Ollama probe fails and was already unavailable', async () => {
            mockDb.query.mockResolvedValue({ rows: [{ primary_provider: 'ollama', ollama_host: 'http://ollama:11434' }] });
            mockOllama.testConnection.mockResolvedValue({ success: false, error: 'timeout' });

            const result = await service.checkAvailability(false, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.warn).not.toHaveBeenCalled();
        });

        it('returns false and logs on unexpected thrown error when currently available', async () => {
            jest.spyOn(service, 'getProvider').mockRejectedValue(new Error('provider exploded'));

            const result = await service.checkAvailability(true, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.warn).toHaveBeenCalledWith('AI availability check failed', { error: 'provider exploded' });
        });

        it('returns false silently on thrown error when already unavailable', async () => {
            jest.spyOn(service, 'getProvider').mockRejectedValue(new Error('provider exploded'));

            const result = await service.checkAvailability(false, mockOllama, mockCallerLogger);

            expect(result).toBe(false);
            expect(mockCallerLogger.warn).not.toHaveBeenCalled();
        });
    });
});
