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

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule, createNamedStubModule, createLoggerModuleMock} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };

const mockOllamaService = {
  generate: jest.fn(),
  generateWithProgress: jest.fn(),
  setGenerationStatus: jest.fn(),
  updateTokenCount: jest.fn(),
};

const mockAiRouter = {
  getProvider: jest.fn(),
  classify: jest.fn(),
};

const mockProviderLock = {
  acquireLock: jest.fn().mockResolvedValue(undefined),
  releaseLock: jest.fn(),
  heartbeat: jest.fn(),
  config: { heartbeatInterval: 5000 },
};

const mockAiPromptBuilder = {
  buildPrompt: jest.fn().mockResolvedValue('SIGNAL_SECTIONS'),
};

const mockAiResponseParser = {
  parse: jest.fn(),
};

const mockTavilyService = {
  formatForAI: jest.fn((x) => String(x)),
};

const mockLibraryProfileService = {
  getProfileStats: jest.fn(),
};

const mockClassificationMetadataService = {
  enrichWithWebSearch: jest.fn().mockResolvedValue(null),
};

const mockClassificationUtilsService = {
  isAiTransientAvailabilityError: jest.fn().mockReturnValue(false),
  sleep: jest.fn().mockResolvedValue(undefined),
  buildParseDiagnostics: jest.fn((p) => ({ ...p, _diagnostics: true })),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllamaService));

jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

jest.unstable_mockModule('../services/providerLock.mjs', () => createNamedMockModule('providerLock', mockProviderLock));

jest.unstable_mockModule('../services/aiPromptBuilder.mjs', () => createNamedStubModule('aiPromptBuilder', mockAiPromptBuilder));

jest.unstable_mockModule('../services/aiResponseParser.mjs', () => createNamedStubModule('aiResponseParser', mockAiResponseParser));

jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavilyService));

jest.unstable_mockModule('../services/libraryProfileService.mjs', () => createNamedMockModule('libraryProfileService', mockLibraryProfileService));

jest.unstable_mockModule('../services/classificationMetadataService.mjs', () => ({ ...mockClassificationMetadataService }));
jest.unstable_mockModule('../services/classificationUtilsService.mjs', () => ({ ...mockClassificationUtilsService }));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { classificationAiService } = await import('../services/classificationAiService.mjs');
const db = mockDb;
const ollamaService = mockOllamaService;
const aiRouter = mockAiRouter;
const providerLock = mockProviderLock;
const aiPromptBuilder = mockAiPromptBuilder;
const aiResponseParser = mockAiResponseParser;
const tavilyService = mockTavilyService;
const libraryProfileService = mockLibraryProfileService;
const classificationMetadataService = mockClassificationMetadataService;
const classificationUtilsService = mockClassificationUtilsService;

const baseMetadata = { title: 'Test Movie', tmdb_id: 111, year: 2024 };
const baseLibraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'TV Shows', media_type: 'tv' },
];

const defaultProviderRow = {
  ollama_model: 'llama3.2',
  temperature: 0.3,
  ai_response_repair_enabled: true,
  classification_disallow_partial_stream_response: true,
};

const goodParseResult = {
  format: 'CONFIDENT',
  libraryId: 1,
  confidence: 85,
  method: 'ai',
  reason: 'genre match',
};

const fallbackParseResult = {
  format: 'fallback',
  parse_failure_reason: 'no_format_matched',
  method: 'fallback',
};

const ollamaProvider = {
  type: 'ollama',
  config: { model: 'llama3.2' },
};

const cloudProvider = {
  type: 'openai',
  config: { model: 'gpt-4o' },
};

function setupHappyPath({
  providerRow = defaultProviderRow,
  provider = ollamaProvider,
  parseResult = goodParseResult,
  generatedResponse = 'CONFIDENT|1|85|genre match',
} = {}) {
  db.query.mockResolvedValueOnce({ rows: providerRow ? [providerRow] : [] });
  aiRouter.getProvider.mockResolvedValueOnce(provider);
  ollamaService.generateWithProgress.mockResolvedValueOnce(generatedResponse);
  aiResponseParser.parse.mockReturnValueOnce({ ...parseResult });
}

describe('normalizeAiResponseLine', () => {
  test('returns "" for null', () => {
    expect(classificationAiService.normalizeAiResponseLine(null)).toBe('');
  });

  test('returns "" for undefined', () => {
    expect(classificationAiService.normalizeAiResponseLine(undefined)).toBe('');
  });

  test('returns "" for non-string value', () => {
    expect(classificationAiService.normalizeAiResponseLine(42)).toBe('');
  });

  test('returns "" for empty string', () => {
    expect(classificationAiService.normalizeAiResponseLine('')).toBe('');
  });

  test('returns first non-empty line from a multi-line string', () => {
    expect(classificationAiService.normalizeAiResponseLine('CONFIDENT|1|85|match\nExtra line'))
      .toBe('CONFIDENT|1|85|match');
  });

  test('trims whitespace from lines', () => {
    expect(classificationAiService.normalizeAiResponseLine('  CONFIDENT|1|85|match  '))
      .toBe('CONFIDENT|1|85|match');
  });

  test('skips blank lines and returns first non-empty line', () => {
    expect(classificationAiService.normalizeAiResponseLine('\n\nCONFIDENT|1|85|match\nOther'))
      .toBe('CONFIDENT|1|85|match');
  });

  test('returns trimmed value when only whitespace lines exist', () => {
    expect(classificationAiService.normalizeAiResponseLine('   \n   \n   ')).toBe('');
  });

  test('returns single-line string as-is (after trim)', () => {
    expect(classificationAiService.normalizeAiResponseLine('CONFIRM|1|looks right'))
      .toBe('CONFIRM|1|looks right');
  });
});

describe('buildAiRepairPrompt', () => {
  const libraries = [
    { id: 1, name: 'Movies', media_type: 'movie' },
    { id: 2, name: 'TV Shows', media_type: 'tv' },
  ];
  const rawResponse = 'uhh I think it goes in movies?';

  test('includes CONFIDENT format for classify mode', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'classify'
    });
    expect(prompt).toContain('CONFIDENT|<library_number>|<confidence_0_to_100>|<brief_reason>');
  });

  test('includes CONFIRM format for verify mode', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'verify'
    });
    expect(prompt).toContain('CONFIRM|<library_number>|<brief_verification_reason>');
  });

  test('does NOT include CONFIRM format for classify mode', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'classify'
    });
    expect(prompt).not.toContain('CONFIRM|<library_number>');
  });

  test('does NOT include CONFIDENT format for verify mode', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'verify'
    });
    expect(prompt).not.toContain('CONFIDENT|<library_number>');
  });

  test('lists libraries with 1-based index', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'classify'
    });
    expect(prompt).toContain('1. Movies (movie)');
    expect(prompt).toContain('2. TV Shows (tv)');
  });

  test('includes the raw response in the prompt', () => {
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'classify'
    });
    expect(prompt).toContain(rawResponse);
  });

  test('includes verify context when mode=verify and signalContext provided', () => {
    const signalContext = { confidence: 75, suggestedLibrary: { name: 'Movies' } };
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext, mode: 'verify'
    });
    expect(prompt).toContain('Pre-calculated confidence: 75%');
    expect(prompt).toContain('Suggested library: Movies');
  });

  test('uses "unknown" for suggestedLibrary name when not set', () => {
    const signalContext = { confidence: 60 };
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext, mode: 'verify'
    });
    expect(prompt).toContain('Suggested library: unknown');
  });

  test('omits verify context for classify mode even with signalContext', () => {
    const signalContext = { confidence: 75, suggestedLibrary: { name: 'Movies' } };
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext, mode: 'classify'
    });
    expect(prompt).not.toContain('Pre-calculated confidence');
  });

  test('uses "unknown" for missing media_type', () => {
    const libsNoType = [{ id: 1, name: 'Movies' }];
    const prompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries: libsNoType, signalContext: null, mode: 'classify'
    });
    expect(prompt).toContain('1. Movies (unknown)');
  });

  test('includes CLARIFY format in both modes', () => {
    const classifyPrompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'classify'
    });
    const verifyPrompt = classificationAiService.buildAiRepairPrompt({
      response: rawResponse, libraries, signalContext: null, mode: 'verify'
    });
    expect(classifyPrompt).toContain('CLARIFY|');
    expect(verifyPrompt).toContain('CLARIFY|');
  });
});

describe('attemptAiResponseRepair', () => {
  beforeEach(() => {
    ollamaService.generate.mockReset();
  });

  const libraries = baseLibraries;
  const response = 'garbled output here';

  test('calls ollamaService.generate with the repair prompt', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|80|match');
    await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 0.3
    });
    expect(ollamaService.generate).toHaveBeenCalledWith(
      expect.stringContaining('CONFIDENT|<library_number>'),
      'llama3.2',
      expect.any(Number)
    );
  });

  test('defaults model to "llama3.2" when not provided', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIRM|1|match');
    await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'verify', model: null, temperature: 0.1
    });
    expect(ollamaService.generate).toHaveBeenCalledWith(
      expect.any(String),
      'llama3.2',
      expect.any(Number)
    );
  });

  test('clamps temperature to max 0.2', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|85|match');
    await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 0.9
    });
    const [[, , temp]] = ollamaService.generate.mock.calls;
    expect(temp).toBe(0.2);
  });

  test('clamps temperature to min 0', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|85|match');
    await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: -1
    });
    const [[, , temp]] = ollamaService.generate.mock.calls;
    expect(temp).toBe(0);
  });

  test('uses 0.1 as default temperature when non-finite given', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|85|match');
    await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 'bad'
    });
    const [[, , temp]] = ollamaService.generate.mock.calls;
    expect(temp).toBe(0.1);
  });

  test('returns normalised single-line response', async () => {
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|85|match\nExtra junk');
    const result = await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 0.1
    });
    expect(result).toBe('CONFIDENT|1|85|match');
  });

  test('returns "" when ollamaService.generate returns null', async () => {
    ollamaService.generate.mockResolvedValueOnce(null);
    const result = await classificationAiService.attemptAiResponseRepair({
      response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 0.1
    });
    expect(result).toBe('');
  });

  test('propagates errors from ollamaService.generate', async () => {
    ollamaService.generate.mockRejectedValueOnce(new Error('Ollama down'));
    await expect(
      classificationAiService.attemptAiResponseRepair({
        response, libraries, signalContext: null, mode: 'classify', model: 'llama3.2', temperature: 0.1
      })
    ).rejects.toThrow('Ollama down');
  });
});

describe('aiClassify', () => {
  beforeEach(() => {
    db.query.mockReset();
    ollamaService.generate.mockReset();
    ollamaService.generateWithProgress.mockReset();
    ollamaService.setGenerationStatus.mockReset();
    ollamaService.updateTokenCount.mockReset();
    aiRouter.getProvider.mockReset();
    aiRouter.classify.mockReset();
    providerLock.acquireLock.mockReset().mockResolvedValue(undefined);
    providerLock.releaseLock.mockReset();
    providerLock.heartbeat.mockReset();
    aiPromptBuilder.buildPrompt.mockReset().mockResolvedValue('SIGNAL_SECTIONS');
    aiResponseParser.parse.mockReset();
    classificationMetadataService.enrichWithWebSearch.mockReset().mockResolvedValue(null);
    classificationUtilsService.isAiTransientAvailabilityError.mockReset().mockReturnValue(false);
    classificationUtilsService.sleep.mockReset().mockResolvedValue(undefined);
    classificationUtilsService.buildParseDiagnostics.mockReset().mockImplementation((p) => ({ ...p, _diagnostics: true }));
    libraryProfileService.getProfileStats.mockReset();
    tavilyService.formatForAI.mockReset().mockImplementation((x) => String(x));
  });

  test('throws when no provider is available', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(null);
    await expect(
      classificationAiService.aiClassify(baseMetadata, baseLibraries)
    ).rejects.toThrow('AI is not available');
  });

  test('uses "classify" mode when no signalContext', async () => {
    setupHappyPath();
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, null, {});
    const [[promptArg]] = aiResponseParser.parse.mock.calls;
    expect(promptArg).not.toContain('VERIFY');
    expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      { mode: 'classify' }
    );
  });

  test('uses "verify" mode when signalContext provided', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIRM|1|looks right');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult, format: 'CONFIRM' });
    const signalContext = { confidence: 90, suggestedLibrary: { id: 1, name: 'Movies' } };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext, {});
    expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      { mode: 'verify' }
    );
  });

  test('options.mode overrides default mode derivation', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    const signalContext = { confidence: 90 };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext, { mode: 'classify' });
    expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledWith(
      expect.any(Object),
      { mode: 'classify' }
    );
  });

  test('uses default model+temperature when ai_provider_config has no row', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(ollamaService.generateWithProgress).toHaveBeenCalled();
  });

  test('provider model overrides config model for generation', async () => {
    const providerRow = { ...defaultProviderRow, ollama_model: 'mistral' };
    db.query.mockResolvedValueOnce({ rows: [providerRow] });
    aiRouter.getProvider.mockResolvedValueOnce({ type: 'ollama', config: { model: 'llama3.3' } });
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    const [[, modelArg]] = ollamaService.generateWithProgress.mock.calls;
    expect(modelArg).toBe('llama3.3');
  });

  test('includes web search results in prompt when enrichWithWebSearch returns data', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    classificationMetadataService.enrichWithWebSearch.mockResolvedValueOnce({
      imdb: 'imdb data',
      advisory: 'advisory data',
      anime: 'anime data',
    });
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    const [[promptArg]] = ollamaService.generateWithProgress.mock.calls;
    expect(promptArg).toContain('ADDITIONAL WEB RESEARCH');
    expect(tavilyService.formatForAI).toHaveBeenCalledTimes(3);
  });

  test('skips web research section when enrichWithWebSearch returns null', async () => {
    setupHappyPath();
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    const [[promptArg]] = ollamaService.generateWithProgress.mock.calls;
    expect(promptArg).not.toContain('ADDITIONAL WEB RESEARCH');
  });

  test('includes only imdb section when only imdb data available', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    classificationMetadataService.enrichWithWebSearch.mockResolvedValueOnce({ imdb: 'imdb data' });
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(tavilyService.formatForAI).toHaveBeenCalledTimes(1);
  });

  test('loads library profile when signalContext.suggestedLibrary set', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    libraryProfileService.getProfileStats.mockResolvedValueOnce({ totalItems: 50, topGenres: ['action'] });
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIRM|1|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult, format: 'CONFIRM' });
    const signalContext = { confidence: 90, suggestedLibrary: { id: 1, name: 'Movies' } };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext, {});
    expect(libraryProfileService.getProfileStats).toHaveBeenCalledWith(1);
  });

  test('skips library profile when totalItems is 0', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    libraryProfileService.getProfileStats.mockResolvedValueOnce({ totalItems: 0 });
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIRM|1|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult, format: 'CONFIRM' });
    const signalContext = { confidence: 90, suggestedLibrary: { id: 1, name: 'Movies' } };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext, {});
    expect(libraryProfileService.getProfileStats).toHaveBeenCalled();
  });

  test('swallows library profile load error and continues', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    libraryProfileService.getProfileStats.mockRejectedValueOnce(new Error('DB error'));
    ollamaService.generateWithProgress.mockResolvedValueOnce('CONFIRM|1|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult, format: 'CONFIRM' });
    const signalContext = { confidence: 90, suggestedLibrary: { id: 1, name: 'Movies' } };
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext, {});
    expect(result.format).toBe('CONFIRM');
  });

  test('acquires and releases the provider lock', async () => {
    setupHappyPath();
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(providerLock.acquireLock).toHaveBeenCalledWith('classification', 'high');
    expect(providerLock.releaseLock).toHaveBeenCalledWith('classification');
  });

  test('releases lock even when generation throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockRejectedValueOnce(new Error('GPU OOM'));
    ollamaService.setGenerationStatus.mockImplementation(() => {});
    await expect(classificationAiService.aiClassify(baseMetadata, baseLibraries)).rejects.toThrow('GPU OOM');
    expect(providerLock.releaseLock).toHaveBeenCalledWith('classification');
  });

  test('uses generateWithProgress for ollama provider', async () => {
    setupHappyPath({ provider: ollamaProvider });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(ollamaService.generateWithProgress).toHaveBeenCalled();
    expect(aiRouter.classify).not.toHaveBeenCalled();
  });

  test('uses aiRouter.classify for cloud provider', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(cloudProvider);
    aiRouter.classify.mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(aiRouter.classify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ taskType: 'classification', requestType: 'classification' })
    );
    expect(ollamaService.generateWithProgress).not.toHaveBeenCalled();
  });

  test('cloud provider requestType is "classification_verify" in verify mode', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(cloudProvider);
    aiRouter.classify.mockResolvedValueOnce('CONFIRM|1|ok');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult, format: 'CONFIRM' });
    const signalContext = { confidence: 90, suggestedLibrary: { id: 1, name: 'Movies' } };
    libraryProfileService.getProfileStats.mockResolvedValueOnce({ totalItems: 0 });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, signalContext);
    expect(aiRouter.classify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ requestType: 'classification_verify' })
    );
  });

  test('retries once on transient stream error then succeeds', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValueOnce(true);
    ollamaService.generateWithProgress
      .mockRejectedValueOnce(Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }))
      .mockResolvedValueOnce('CONFIDENT|1|80|match');
    aiResponseParser.parse.mockReturnValueOnce({ ...goodParseResult });
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('CONFIDENT');
    expect(ollamaService.generateWithProgress).toHaveBeenCalledTimes(2);
    expect(classificationUtilsService.sleep).toHaveBeenCalled();
  });

  test('throws on second transient stream error (maxAttempts=2)', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    classificationUtilsService.isAiTransientAvailabilityError
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    const err = Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' });
    ollamaService.generateWithProgress.mockRejectedValue(err);
    await expect(classificationAiService.aiClassify(baseMetadata, baseLibraries)).rejects.toThrow('ECONNRESET');
    expect(ollamaService.generateWithProgress).toHaveBeenCalledTimes(2);
  });

  test('throws immediately on non-transient stream error', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    classificationUtilsService.isAiTransientAvailabilityError.mockReturnValueOnce(false);
    ollamaService.generateWithProgress.mockRejectedValueOnce(new Error('Fatal GPU error'));
    await expect(classificationAiService.aiClassify(baseMetadata, baseLibraries)).rejects.toThrow('Fatal GPU error');
    expect(ollamaService.generateWithProgress).toHaveBeenCalledTimes(1);
  });

  test('returns parse result with diagnostics when first parse succeeds', async () => {
    setupHappyPath({ parseResult: goodParseResult });
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('CONFIDENT');
    expect(result.parse_diagnostics).toMatchObject({ mode: 'classify', attemptCount: 1 });
    expect(result.parse_diagnostics._diagnostics).toBe(true);
  });

  test('does NOT call attemptAiResponseRepair when first parse succeeds', async () => {
    setupHappyPath({ parseResult: goodParseResult });
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(ollamaService.generate).not.toHaveBeenCalled();
  });

  test('calls repair when first parse is fallback and repair enabled', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled response');
    aiResponseParser.parse
      .mockReturnValueOnce({ ...fallbackParseResult })
      .mockReturnValueOnce({ ...goodParseResult });
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|85|match');
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('CONFIDENT');
    expect(result.parse_diagnostics).toMatchObject({ repairSucceeded: true, attemptCount: 2 });
  });

  test('returns fallback with repair diagnostics when repair parse also fails', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled response');
    aiResponseParser.parse
      .mockReturnValueOnce({ ...fallbackParseResult })
      .mockReturnValueOnce({ ...fallbackParseResult });
    ollamaService.generate.mockResolvedValueOnce('still garbled');
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('fallback');
    expect(result.parse_diagnostics).toMatchObject({ repairAttempted: true, repairSucceeded: false });
  });

  test('skips repair when ai_response_repair_enabled is false', async () => {
    const noRepairRow = { ...defaultProviderRow, ai_response_repair_enabled: false };
    db.query.mockResolvedValueOnce({ rows: [noRepairRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled');
    aiResponseParser.parse.mockReturnValueOnce({ ...fallbackParseResult });
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(ollamaService.generate).not.toHaveBeenCalled();
    expect(result.parse_diagnostics).toMatchObject({ repairAttempted: false });
  });

  test('continues with fallback result when repair throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled');
    aiResponseParser.parse.mockReturnValueOnce({ ...fallbackParseResult });
    ollamaService.generate.mockRejectedValueOnce(new Error('repair model unavailable'));
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('fallback');
    expect(result.parse_diagnostics).toMatchObject({ repairAttempted: true, repairSucceeded: false });
  });

  test('continues with fallback when repair returns empty string', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled');
    aiResponseParser.parse.mockReturnValueOnce({ ...fallbackParseResult });
    ollamaService.generate.mockResolvedValueOnce('');
    const result = await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(result.format).toBe('fallback');
  });

  test('attaches parse_diagnostics with mode and attemptCount=1 on success', async () => {
    setupHappyPath();
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(classificationUtilsService.buildParseDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'classify', attemptCount: 1 })
    );
  });

  test('attaches parse_diagnostics with attemptCount=2 on repair success', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockResolvedValueOnce('garbled');
    aiResponseParser.parse
      .mockReturnValueOnce({ ...fallbackParseResult })
      .mockReturnValueOnce({ ...goodParseResult });
    ollamaService.generate.mockResolvedValueOnce('CONFIDENT|1|80|match');
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(classificationUtilsService.buildParseDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({ attemptCount: 2, repairSucceeded: true })
    );
  });

  test('sets generation status to true before and false after generation', async () => {
    setupHappyPath();
    await classificationAiService.aiClassify(baseMetadata, baseLibraries);
    expect(ollamaService.setGenerationStatus).toHaveBeenCalledWith(true, expect.any(String), expect.any(String));
    expect(ollamaService.setGenerationStatus).toHaveBeenCalledWith(false);
  });

  test('clears generation status even when generation throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [defaultProviderRow] });
    aiRouter.getProvider.mockResolvedValueOnce(ollamaProvider);
    ollamaService.generateWithProgress.mockRejectedValueOnce(new Error('crash'));
    await expect(classificationAiService.aiClassify(baseMetadata, baseLibraries)).rejects.toThrow('crash');
    expect(ollamaService.setGenerationStatus).toHaveBeenCalledWith(false);
  });

  test('passes ragContext from options to promptContext', async () => {
    setupHappyPath();
    const ragContext = { items: [{ title: 'Similar Movie' }] };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, null, { ragContext });
    expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ ragContext }),
      expect.any(Object)
    );
  });

  test('passes policySignals from options to promptContext', async () => {
    setupHappyPath();
    const policySignals = { genre_boost: 0.8 };
    await classificationAiService.aiClassify(baseMetadata, baseLibraries, null, { policySignals });
    expect(aiPromptBuilder.buildPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ policySignals }),
      expect.any(Object)
    );
  });
});
