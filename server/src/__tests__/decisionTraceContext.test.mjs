/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  buildDecisionTraceMetadata,
  createDecisionTraceContext,
  serializeDecisionTraceContext,
} from '../services/decisionTraceContext.mjs';

const TRACE_ID_RE = /^[0-9a-f]{32}$/;
const SPAN_ID_RE = /^[0-9a-f]{16}$/;
const TRACEPARENT_RE = /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('decisionTraceContext', () => {
  test('creates W3C-compatible trace context fields', () => {
    const context = createDecisionTraceContext();

    expect(context.trace_id).toMatch(TRACE_ID_RE);
    expect(context.root_span_id).toMatch(SPAN_ID_RE);
    expect(context.traceparent).toMatch(TRACEPARENT_RE);
    expect(context.correlation_id).toMatch(UUID_RE);
  });

  test('inherits valid traceparent values', () => {
    const context = createDecisionTraceContext({
      trace_context: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    });

    expect(context.trace_id).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(context.root_span_id).toBe('00f067aa0ba902b7');
    expect(context.trace_flags).toBe('01');
  });

  test('rejects invalid all-zero traceparent values and generates a new trace', () => {
    const context = createDecisionTraceContext({
      trace_context: {
        traceparent: '00-00000000000000000000000000000000-0000000000000000-01',
      },
    });

    expect(context.trace_id).toMatch(TRACE_ID_RE);
    expect(context.root_span_id).toMatch(SPAN_ID_RE);
    expect(context.trace_id).not.toBe('00000000000000000000000000000000');
    expect(context.root_span_id).not.toBe('0000000000000000');
  });

  test('serializes only bounded correlation fields', () => {
    const serialized = serializeDecisionTraceContext({
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      root_span_id: '00f067aa0ba902b7',
      trace_flags: '01',
      correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
      source: 'test',
      secret: 'do-not-copy',
    });

    expect(serialized).toEqual({
      schema_version: 1,
      trace_id: '4bf92f3577b34da6a3ce929d0e0e4736',
      root_span_id: '00f067aa0ba902b7',
      trace_flags: '01',
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
      source: 'test',
    });
  });

  test('builds compact decision trace metadata without copying raw inputs', () => {
    const trace = buildDecisionTraceMetadata({
      context: createDecisionTraceContext({
        trace_context: {
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
      correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
    }),
      result: {
        method: 'ai_rerun',
        confidence: 72,
        reason: 'contains raw prompt text that should not be copied',
        ragLoopTrace: {
          decision: { outcome: 'pass2', reason: 'candidate_improved' },
          trace_context: {
            root_span_id: '00f067aa0ba902b7',
            correlation_id: '95f95cb5-fce5-4d84-9ac4-5f2838f307f4',
          },
        },
      },
      status: 'awaiting_decision',
      libraryId: null,
      libraryName: null,
      startedAt: Date.UTC(2026, 5, 6, 12, 0, 0),
      completedAt: new Date(Date.UTC(2026, 5, 6, 12, 0, 1)),
      processingTimeMs: 1000,
    });

    expect(trace.traceparent).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
    expect(trace.sampled).toBe(true);
    expect(trace.outcome).toMatchObject({
      status: 'awaiting_decision',
      method: 'ai_rerun',
      confidence: 72,
    });
    expect(trace.stages).toContainEqual(expect.objectContaining({
      name: 'rag_loop',
      outcome: 'pass2',
      reason_code: 'candidate_improved',
    }));
    expect(JSON.stringify(trace)).not.toContain('raw prompt text');
  });
});
