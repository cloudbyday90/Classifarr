/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { createDecisionTraceContext } from '../services/decisionTraceContext.mjs';
import { createDecisionTraceSpanCollector } from '../services/decisionTraceSpanCollector.mjs';

describe('decisionTraceSpanCollector', () => {
  test('records bounded child spans under the root trace', () => {
    const root = createDecisionTraceContext({
      trace_context: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00',
        correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
      },
    });
    const collector = createDecisionTraceSpanCollector(root);

    const span = collector.startStage('retrieval_pass2', {
      strategy: 'hybrid',
      unsafe_payload: { prompt: 'do not copy' },
    });
    expect(span.span_id).toMatch(/^[0-9a-f]{16}$/);
    collector.finishStage('retrieval_pass2', {
      outcome: 'applied',
      reasonCode: 'hybrid',
      attributes: {
        match_count: 5,
      },
    });

    const snapshot = collector.toJSON();
    expect(snapshot.spans).toHaveLength(1);
    expect(snapshot.spans[0]).toEqual(expect.objectContaining({
      schema_version: 1,
      name: 'retrieval_pass2',
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
      parent_span_id: '00f067aa0ba902b7',
      traceparent: expect.stringMatching(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-00$/),
      duration_ms: expect.any(Number),
      outcome: 'applied',
      reason_code: 'hybrid',
      status: 'ok',
      attributes: {
        strategy: 'hybrid',
        match_count: 5,
      },
    }));
    expect(JSON.stringify(snapshot)).not.toContain('do not copy');
  });

  test('truncates spans at configured bound', () => {
    const collector = createDecisionTraceSpanCollector(createDecisionTraceContext(), { maxSpans: 1 });

    collector.startStage('gate');
    collector.finishStage('gate', { outcome: 'run' });
    collector.startStage('enrichment');
    collector.finishStage('enrichment', { outcome: 'skipped' });

    const snapshot = collector.toJSON();
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.spans).toHaveLength(1);
    expect(snapshot.spans[0].name).toBe('gate');
  });

  test('normalizes unknown stage names to trace', () => {
    const collector = createDecisionTraceSpanCollector(createDecisionTraceContext());
    collector.startStage('unknown_stage');
    collector.finishStage('unknown_stage', { outcome: 'error' });

    expect(collector.toJSON().spans[0]).toEqual(expect.objectContaining({
      name: 'trace',
      status: 'error',
    }));
  });
});
