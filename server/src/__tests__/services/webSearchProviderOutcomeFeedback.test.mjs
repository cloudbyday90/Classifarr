/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS,
  WebSearchProviderOutcomeFeedbackService,
  classifyWebSearchProviderOutcomeFeedback,
} from '../../services/webSearchProviderOutcomeFeedback.mjs';

function createMockDb(rows = []) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows };
    },
  };
}

describe('webSearchProviderOutcomeFeedback', () => {
  test('classifies linked corrections before current status', () => {
    expect(classifyWebSearchProviderOutcomeFeedback({
      classificationStatus: 'completed',
      latestOutcomeType: 'corrected',
    })).toBe(WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.NEGATIVE);
  });

  test('classifies terminal, pending, and unknown statuses', () => {
    expect(classifyWebSearchProviderOutcomeFeedback({ classificationStatus: 'routed' }))
      .toBe(WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.POSITIVE);
    expect(classifyWebSearchProviderOutcomeFeedback({ classificationStatus: 'awaiting_decision' }))
      .toBe(WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.PENDING);
    expect(classifyWebSearchProviderOutcomeFeedback({ classificationStatus: 'something_new' }))
      .toBe(WEB_SEARCH_PROVIDER_OUTCOME_FEEDBACK_SIGNALS.NEUTRAL);
  });

  test('loads sanitized provider outcome summaries from route decisions', async () => {
    const db = createMockDb([{
      provider_key: 'tavily',
      positive_outcomes: 7,
      negative_outcomes: 2,
      pending_outcomes: 1,
      neutral_outcomes: 0,
      outcome_signal_count: 9,
    }]);
    const service = new WebSearchProviderOutcomeFeedbackService({ db });

    const summaries = await service.getProviderOutcomeFeedbackSummaries(['tavily', 'bad key!'], {
      purpose: 'classification_enrichment',
      now: new Date('2026-06-25T12:00:00.000Z'),
      lookbackDays: 10,
    });

    expect([...summaries.keys()]).toEqual(['tavily']);
    expect(summaries.get('tavily')).toEqual({
      providerKey: 'tavily',
      positiveOutcomes: 7,
      negativeOutcomes: 2,
      pendingOutcomes: 1,
      neutralOutcomes: 0,
      outcomeSignalCount: 9,
    });
    expect(db.calls[0].params).toEqual([
      ['tavily'],
      'classification_enrichment',
      new Date('2026-06-25T12:00:00.000Z'),
      10,
    ]);
    expect(db.calls[0].sql).toContain('web_search_provider_route_decisions');
    expect(db.calls[0].sql).toContain('classification_history');
    expect(db.calls[0].sql).not.toContain('query');
    expect(db.calls[0].sql).not.toContain('api_key');
  });

  test('safe lookup returns neutral map when feedback query fails', async () => {
    const service = new WebSearchProviderOutcomeFeedbackService({
      db: {
        query: async () => {
          throw new Error('relation does not exist');
        },
      },
    });

    await expect(service.getProviderOutcomeFeedbackSummariesSafely(['tavily']))
      .resolves.toEqual(new Map());
  });
});
