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
import { createMockModule } from './helpers/mockFactory.mjs';

const mockAxios = { get: jest.fn(), post: jest.fn() };
jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => createMockModule(mockAxios));

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
  })),
  default: {
    createLogger: jest.fn(() => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
    }))
  }
}));

const axios = mockAxios;
const db = mockDb;
const { default: svc } = await import('../services/cloudLLM.mjs');

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  db.query.mockReset();
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getEndpoint
// ---------------------------------------------------------------------------

describe('getEndpoint', () => {
  test('uses custom endpoint for litellm', () => {
    const cfg = { primary_provider: 'litellm', api_endpoint: 'http://my-litellm:4000/v1' };
    expect(svc.getEndpoint(cfg)).toBe('http://my-litellm:4000/v1');
  });

  test('uses custom endpoint for custom provider', () => {
    const cfg = { primary_provider: 'custom', api_endpoint: 'http://custom:8080/v1' };
    expect(svc.getEndpoint(cfg)).toBe('http://custom:8080/v1');
  });

  test('ignores custom endpoint for openai — uses official URL', () => {
    const cfg = { primary_provider: 'openai', api_endpoint: 'http://ignored/v1' };
    expect(svc.getEndpoint(cfg)).toBe('https://api.openai.com/v1');
  });

  test('ignores custom endpoint for openrouter', () => {
    const cfg = { primary_provider: 'openrouter', api_endpoint: 'http://ignored/v1' };
    expect(svc.getEndpoint(cfg)).toBe('https://openrouter.ai/api/v1');
  });

  test('falls back to api_endpoint when provider not in defaults', () => {
    const cfg = { primary_provider: 'unknown_provider', api_endpoint: 'http://fallback/v1' };
    expect(svc.getEndpoint(cfg)).toBe('http://fallback/v1');
  });
});

// ---------------------------------------------------------------------------
// getHeaders
// ---------------------------------------------------------------------------

describe('getHeaders', () => {
  test('includes Authorization Bearer when api_key present', () => {
    const headers = svc.getHeaders({ api_key: 'sk-test', primary_provider: 'openai' });
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('no Authorization header when api_key absent', () => {
    const headers = svc.getHeaders({ primary_provider: 'litellm' });
    expect(headers['Authorization']).toBeUndefined();
  });

  test('adds OpenRouter-specific headers', () => {
    const headers = svc.getHeaders({ api_key: 'or-key', primary_provider: 'openrouter' });
    expect(headers['HTTP-Referer']).toBe('https://classifarr.local');
    expect(headers['X-Title']).toBe('Classifarr');
  });

  test('does not add OpenRouter headers for other providers', () => {
    const headers = svc.getHeaders({ api_key: 'sk-test', primary_provider: 'openai' });
    expect(headers['HTTP-Referer']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// calculateCost
// ---------------------------------------------------------------------------

describe('calculateCost', () => {
  test('uses OpenRouter header pricing when present', () => {
    const headers = {
      'x-openrouter-price-per-prompt-token': '0.000005',
      'x-openrouter-price-per-completion-token': '0.000015'
    };
    const cost = svc.calculateCost('openrouter', 'any-model', 1000, 200, headers);
    expect(cost).toBeCloseTo(1000 * 0.000005 + 200 * 0.000015);
  });

  test('falls back to OPENAI_PRICING for known model', () => {
    // gpt-4o: input $5/1M, output $15/1M
    const cost = svc.calculateCost('openai', 'gpt-4o', 1000000, 0);
    expect(cost).toBeCloseTo(5.0);
  });

  test('uses default $5/1M fallback for unknown model', () => {
    const cost = svc.calculateCost('openai', 'unknown-model', 1000000, 0);
    expect(cost).toBeCloseTo(5.0);
  });

  test('sums input + output tokens for known OpenAI model', () => {
    // o3-mini: input $1.10/1M, output $4.40/1M
    const cost = svc.calculateCost('openai', 'o3-mini', 500000, 500000);
    expect(cost).toBeCloseTo((0.5 * 1.10) + (0.5 * 4.40));
  });
});

// ---------------------------------------------------------------------------
// calculateGeminiCost
// ---------------------------------------------------------------------------

describe('calculateGeminiCost', () => {
  test('uses GEMINI_PRICING for known model', () => {
    // gemini-2.0-flash: input $0.10/1M, output $0.40/1M
    const cost = svc.calculateGeminiCost('gemini-2.0-flash', 1000000, 500000);
    expect(cost).toBeCloseTo(0.10 + 0.20);
  });

  test('uses $0.50/1M default for unknown model', () => {
    const cost = svc.calculateGeminiCost('gemini-unknown-future', 1000000, 0);
    expect(cost).toBeCloseTo(0.5);
  });

  test('returns 0 for free experimental model', () => {
    const cost = svc.calculateGeminiCost('gemini-2.0-flash-exp', 1000000, 1000000);
    expect(cost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// testConnection
// ---------------------------------------------------------------------------

describe('testConnection', () => {
  test('returns success with model list', async () => {
    axios.get.mockResolvedValueOnce({
      data: { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] }
    });
    const cfg = { primary_provider: 'openai', api_key: 'sk-test' };
    const result = await svc.testConnection(cfg);
    expect(result.success).toBe(true);
    expect(result.models).toContain('gpt-4o');
  });

  test('returns error on axios failure', async () => {
    const err = new Error('Network error');
    err.response = { data: { error: { message: 'Unauthorized' } } };
    axios.get.mockRejectedValueOnce(err);
    const cfg = { primary_provider: 'openai', api_key: 'bad-key' };
    const result = await svc.testConnection(cfg);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Unauthorized');
  });

  test('delegates to testGeminiConnection for gemini provider', async () => {
    const spy = jest.spyOn(svc, 'testGeminiConnection').mockResolvedValueOnce({ success: true, message: 'ok', models: [] });
    const cfg = { primary_provider: 'gemini', api_key: 'gemini-key' };
    const result = await svc.testConnection(cfg);
    expect(spy).toHaveBeenCalledWith(cfg);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// testGeminiConnection
// ---------------------------------------------------------------------------

describe('testGeminiConnection', () => {
  test('returns success with Gemini model list', async () => {
    axios.get.mockResolvedValueOnce({
      data: { models: [{ name: 'models/gemini-2.0-flash' }] }
    });
    const result = await svc.testGeminiConnection({ api_key: 'gkey' });
    expect(result.success).toBe(true);
    expect(result.models).toContain('gemini-2.0-flash');
  });

  test('returns error on failure', async () => {
    const err = new Error('Bad key');
    err.response = { data: { error: { message: 'Invalid API key' } } };
    axios.get.mockRejectedValueOnce(err);
    const result = await svc.testGeminiConnection({ api_key: 'bad' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });
});

// ---------------------------------------------------------------------------
// getModels
// ---------------------------------------------------------------------------

describe('getModels', () => {
  test('filters out embedding/whisper/tts models', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'text-embedding-3-small', owned_by: 'openai' },
          { id: 'whisper-1', owned_by: 'openai' },
          { id: 'tts-1', owned_by: 'openai' }
        ]
      }
    });
    const result = await svc.getModels({ primary_provider: 'openai', api_key: 'k' });
    expect(result.map(m => m.id)).toEqual(['gpt-4o']);
  });

  test('returns [] on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('Network'));
    const result = await svc.getModels({ primary_provider: 'openai', api_key: 'k' });
    expect(result).toEqual([]);
  });

  test('delegates to getGeminiModels for gemini', async () => {
    const spy = jest.spyOn(svc, 'getGeminiModels').mockResolvedValueOnce([{ id: 'gemini-2.0-flash' }]);
    const result = await svc.getModels({ primary_provider: 'gemini', api_key: 'k' });
    expect(spy).toHaveBeenCalled();
    expect(result[0].id).toBe('gemini-2.0-flash');
  });
});

// ---------------------------------------------------------------------------
// getEmbeddingModels
// ---------------------------------------------------------------------------

describe('getEmbeddingModels', () => {
  test('returns only embedding models', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [
          { id: 'gpt-4o', owned_by: 'openai' },
          { id: 'text-embedding-3-small', owned_by: 'openai' },
          { id: 'text-embedding-ada-002', owned_by: 'openai' }
        ]
      }
    });
    const result = await svc.getEmbeddingModels({ primary_provider: 'openai', api_key: 'k' });
    expect(result.map(m => m.id)).toContain('text-embedding-3-small');
    expect(result.map(m => m.id)).toContain('text-embedding-ada-002');
    expect(result.map(m => m.id)).not.toContain('gpt-4o');
  });

  test('returns [] on error', async () => {
    axios.get.mockRejectedValueOnce(new Error('fail'));
    expect(await svc.getEmbeddingModels({ primary_provider: 'openai', api_key: 'k' })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// logUsage
// ---------------------------------------------------------------------------

describe('logUsage', () => {
  test('inserts into ai_usage_log', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.logUsage({ provider: 'openai', model: 'gpt-4o', promptTokens: 100, completionTokens: 50, totalTokens: 150, costUSD: 0.001, requestType: 'classification', itemTitle: 'Test', success: true, errorMessage: null });
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ai_usage_log'), expect.any(Array));
  });

  test('swallows DB errors', async () => {
    db.query.mockRejectedValueOnce(new Error('table missing'));
    await expect(svc.logUsage({ provider: 'openai', model: 'gpt-4o', promptTokens: 0, completionTokens: 0, totalTokens: 0, costUSD: 0, requestType: 'test', success: true })).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateMonthlyUsage
// ---------------------------------------------------------------------------

describe('updateMonthlyUsage', () => {
  test('updates ai_provider_config', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.updateMonthlyUsage(0.005);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ai_provider_config'),
      [0.005]
    );
  });

  test('swallows DB errors', async () => {
    db.query.mockRejectedValueOnce(new Error('error'));
    await expect(svc.updateMonthlyUsage(0.1)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// logEmbeddingCost
// ---------------------------------------------------------------------------

describe('logEmbeddingCost', () => {
  test('inserts into embedding_costs', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await svc.logEmbeddingCost('openai', 'text-embedding-3-small', 500, 0.00001);
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO embedding_costs'),
      expect.any(Array)
    );
  });

  test('swallows DB errors', async () => {
    db.query.mockRejectedValueOnce(new Error('error'));
    await expect(svc.logEmbeddingCost('openai', 'model', 100, 0)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// checkBudget
// ---------------------------------------------------------------------------

describe('checkBudget', () => {
  test('returns {exhausted: false} when no config rows', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    expect(await svc.checkBudget()).toEqual({ exhausted: false });
  });

  test('returns {exhausted: false} when no monthly_budget_usd set', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ monthly_budget_usd: null, current_month_usage_usd: 10, pause_on_budget_exhausted: false }] });
    expect((await svc.checkBudget()).exhausted).toBe(false);
  });

  test('returns exhausted=false when under budget', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ monthly_budget_usd: '100', current_month_usage_usd: '50', pause_on_budget_exhausted: true }] });
    const result = await svc.checkBudget();
    expect(result.exhausted).toBe(false);
    expect(result.shouldPause).toBe(false);
    expect(result.percentUsed).toBe(50);
  });

  test('returns exhausted=true + shouldPause when over budget and pause enabled', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ monthly_budget_usd: '100', current_month_usage_usd: '100', pause_on_budget_exhausted: true }] });
    const result = await svc.checkBudget();
    expect(result.exhausted).toBe(true);
    expect(result.shouldPause).toBe(true);
  });

  test('returns exhausted=true + shouldPause=false when pause disabled', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ monthly_budget_usd: '100', current_month_usage_usd: '110', pause_on_budget_exhausted: false }] });
    const result = await svc.checkBudget();
    expect(result.exhausted).toBe(true);
    expect(result.shouldPause).toBe(false);
  });

  test('returns {exhausted: false} on DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    expect(await svc.checkBudget()).toEqual({ exhausted: false });
  });
});

// ---------------------------------------------------------------------------
// resetMonthlyUsage
// ---------------------------------------------------------------------------

describe('resetMonthlyUsage', () => {
  test('archives usage and resets running total', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // INSERT archive
      .mockResolvedValueOnce({ rows: [] }); // UPDATE reset
    await svc.resetMonthlyUsage();
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toContain('ai_usage_monthly');
    expect(db.query.mock.calls[1][0]).toContain('UPDATE ai_provider_config');
  });

  test('swallows DB errors', async () => {
    db.query.mockRejectedValueOnce(new Error('error'));
    await expect(svc.resetMonthlyUsage()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getUsageStats
// ---------------------------------------------------------------------------

describe('getUsageStats', () => {
  test('returns structured stats from three queries', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ total_requests: '10', total_tokens: '5000', total_cost: '0.05', successful_requests: '9' }] })
      .mockResolvedValueOnce({ rows: [{ total_requests: '20', total_tokens: '10000', total_cost_usd: '0.10' }] })
      .mockResolvedValueOnce({ rows: [{ monthly_budget_usd: '100', current_month_usage_usd: '5', budget_alert_threshold: 80 }] });

    const stats = await svc.getUsageStats();
    expect(stats.currentMonth.requests).toBe(10);
    expect(stats.currentMonth.successRate).toBe(90);
    expect(stats.lastMonth.cost).toBeCloseTo(0.10);
    expect(stats.budget.limit).toBe(100);
  });

  test('returns null on DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB error'));
    expect(await svc.getUsageStats()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// chat (OpenAI-compatible)
// ---------------------------------------------------------------------------

describe('chat', () => {
  const cfg = { primary_provider: 'openai', api_key: 'sk-test', model: 'gpt-4o', temperature: '0.7', max_tokens: '2000' };
  const messages = [{ role: 'user', content: 'Classify this' }];

  test('returns content and usage on success', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: 'Classification result' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        model: 'gpt-4o'
      },
      headers: {}
    });
    db.query
      .mockResolvedValueOnce({ rows: [] }) // logUsage
      .mockResolvedValueOnce({ rows: [] }); // updateMonthlyUsage

    const result = await svc.chat(messages, cfg, { requestType: 'classification', itemTitle: 'My Movie' });
    expect(result.content).toBe('Classification result');
    expect(result.usage.promptTokens).toBe(50);
    expect(result.finishReason).toBe('stop');
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({ model: 'gpt-4o', messages }),
      expect.any(Object)
    );
  });

  test('uses Responses API for official OpenAI reasoning models', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        output_text: 'Classification result',
        usage: { input_tokens: 50, output_tokens: 100, total_tokens: 150 },
        model: 'gpt-5.2',
        status: 'completed'
      },
      headers: {}
    });
    db.query
      .mockResolvedValueOnce({ rows: [] }) // logUsage
      .mockResolvedValueOnce({ rows: [] }); // updateMonthlyUsage

    const reasoningMessages = [
      { role: 'system', content: 'You are a media classification assistant.' },
      { role: 'user', content: 'Classify this' }
    ];

    const result = await svc.chat(reasoningMessages, { ...cfg, model: 'gpt-5.2', temperature: '0.2' });

    expect(result.content).toBe('Classification result');
    expect(result.usage.promptTokens).toBe(50);
    expect(result.usage.completionTokens).toBe(100);
    expect(result.finishReason).toBe('completed');
    expect(axios.post.mock.calls[0][0]).toContain('/responses');
    const requestBody = axios.post.mock.calls[0][1];
    expect(requestBody).toEqual({
      model: 'gpt-5.2',
      input: [
        { role: 'developer', content: 'You are a media classification assistant.' },
        { role: 'user', content: 'Classify this' }
      ],
      max_output_tokens: 2000
    });
    expect(requestBody).not.toHaveProperty('messages');
    expect(requestBody).not.toHaveProperty('max_completion_tokens');
    expect(requestBody).not.toHaveProperty('max_tokens');
    expect(requestBody).not.toHaveProperty('temperature');
  });

  test('parses Responses API output message content when output_text is omitted', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        output: [
          { type: 'reasoning', summary: [] },
          {
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'Output array result' }]
          }
        ],
        usage: { input_tokens: 20, output_tokens: 30, total_tokens: 50 },
        status: 'completed'
      },
      headers: {}
    });
    db.query
      .mockResolvedValueOnce({ rows: [] }) // logUsage
      .mockResolvedValueOnce({ rows: [] }); // updateMonthlyUsage

    const result = await svc.chat(messages, { ...cfg, model: 'o3-mini' });

    expect(result.content).toBe('Output array result');
    expect(result.usage.totalTokens).toBe(50);
    expect(result.model).toBe('o3-mini');
  });

  test('keeps legacy token parameter for OpenAI-compatible gateways', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: 'Classification result' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        model: 'o3'
      },
      headers: {}
    });
    db.query
      .mockResolvedValueOnce({ rows: [] }) // logUsage
      .mockResolvedValueOnce({ rows: [] }); // updateMonthlyUsage

    const gatewayConfig = { ...cfg, primary_provider: 'openrouter', model: 'o3' };
    const gatewayMessages = [
      { role: 'system', content: 'You are a media classification assistant.' },
      { role: 'user', content: 'Classify this' }
    ];

    await svc.chat(gatewayMessages, gatewayConfig);

    const requestBody = axios.post.mock.calls[0][1];
    expect(requestBody).toEqual({
      model: 'o3',
      messages: gatewayMessages,
      temperature: 0.7,
      max_tokens: 2000
    });
  });

  test('delegates to chatGemini when provider=gemini', async () => {
    const spy = jest.spyOn(svc, 'chatGemini').mockResolvedValueOnce({ content: 'gemini result', usage: {}, model: 'gemini-2.0-flash', finishReason: 'STOP' });
    const geminiCfg = { ...cfg, primary_provider: 'gemini' };
    await svc.chat(messages, geminiCfg);
    expect(spy).toHaveBeenCalledWith(messages, geminiCfg, {}, expect.any(Number));
  });

  test('logs failed request and rethrows on axios error', async () => {
    const err = new Error('API timeout');
    axios.post.mockRejectedValueOnce(err);
    db.query.mockResolvedValueOnce({ rows: [] }); // logUsage for failure

    await expect(svc.chat(messages, cfg)).rejects.toThrow('API timeout');
  });
});

// ---------------------------------------------------------------------------
// embed (OpenAI-compatible)
// ---------------------------------------------------------------------------

describe('embed', () => {
  const cfg = { primary_provider: 'openai', api_key: 'sk-test' };

  test('returns embedding, dims, cost, tokens on success', async () => {
    const vec = Array.from({ length: 1536 }, (_, i) => i * 0.001);
    axios.post.mockResolvedValueOnce({
      data: {
        data: [{ embedding: vec }],
        usage: { total_tokens: 20 }
      }
    });
    db.query.mockResolvedValueOnce({ rows: [] }); // logEmbeddingCost

    const result = await svc.embed('Some text', cfg);
    expect(result.embedding).toHaveLength(1536);
    expect(result.dims).toBe(1536);
    expect(result.tokens).toBe(20);
    expect(typeof result.cost).toBe('number');
  });

  test('uses large model pricing when model name contains "large"', async () => {
    axios.post.mockResolvedValueOnce({
      data: { data: [{ embedding: [0.1] }], usage: { total_tokens: 1000000 } }
    });
    db.query.mockResolvedValueOnce({ rows: [] });

    const result = await svc.embed('text', cfg, 'text-embedding-3-large');
    // 1M tokens * $0.13/M = $0.13
    expect(result.cost).toBeCloseTo(0.13);
  });

  test('rethrows AbortError without logging usage failure', async () => {
    const abortErr = new Error('Aborted');
    abortErr.name = 'AbortError';
    axios.post.mockRejectedValueOnce(abortErr);

    await expect(svc.embed('text', cfg)).rejects.toThrow('Aborted');
  });

  test('rethrows non-abort errors', async () => {
    axios.post.mockRejectedValueOnce(new Error('Network down'));
    await expect(svc.embed('text', cfg)).rejects.toThrow('Network down');
  });
});

// ---------------------------------------------------------------------------
// embedGemini
// ---------------------------------------------------------------------------

describe('embedGemini', () => {
  const cfg = { api_key: 'gkey' };

  test('returns embedding from Gemini API', async () => {
    const vec = [0.1, 0.2, 0.3];
    axios.post.mockResolvedValueOnce({
      data: { embedding: { values: vec } }
    });
    db.query.mockResolvedValueOnce({ rows: [] }); // logEmbeddingCost

    const result = await svc.embedGemini('Some text', cfg);
    expect(result.embedding).toEqual(vec);
    expect(result.dims).toBe(3);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('embedContent'),
      expect.any(Object),
      expect.any(Object)
    );
  });

  test('rethrows AbortError', async () => {
    const err = new Error('canceled');
    err.code = 'ERR_CANCELED';
    axios.post.mockRejectedValueOnce(err);
    await expect(svc.embedGemini('text', cfg)).rejects.toThrow('canceled');
  });

  test('rethrows other errors', async () => {
    axios.post.mockRejectedValueOnce(new Error('Gemini error'));
    await expect(svc.embedGemini('text', cfg)).rejects.toThrow('Gemini error');
  });
});
