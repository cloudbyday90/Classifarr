/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it, expect } from 'vitest'
import {
  parseClassificationMetadata,
  getRagLoopTrace,
  buildRagLoopTraceSummary,
  buildTargetedRecheckDiagnostic
} from '../utils/ragLoopUi'

describe('ragLoopUi utility helpers', () => {
  const traceFixture = {
    trace_version: 1,
    mode: 'shadow',
    ran: true,
    trigger: 'policy_prompt_select',
    strategy: 'auto',
    diagnostics: {
      pass1: { top_similarity: 0.42 },
      pass2: { top_similarity: 0.67 }
    },
    decision: {
      outcome: 'baseline',
      reason: 'no_change'
    },
    events: [
      { stage: 'gate', outcome: 'run', reason_code: 'policy_prompt_select' },
      { stage: 'policy_recheck', outcome: 'evaluated', reason_code: 'insufficient_gain' }
    ]
  }

  it('parses metadata JSON string safely', () => {
    const parsed = parseClassificationMetadata(JSON.stringify({ a: 1 }))
    expect(parsed).toEqual({ a: 1 })
  })

  it('returns null for invalid metadata JSON', () => {
    expect(parseClassificationMetadata('{invalid')).toBeNull()
  })

  it('extracts rag loop trace from classification metadata', () => {
    const trace = getRagLoopTrace({
      classification_details: {
        rag_loop_trace: traceFixture
      }
    })
    expect(trace).toEqual(traceFixture)
  })

  it('builds compact summary fields from trace', () => {
    const summary = buildRagLoopTraceSummary({
      classification_details: {
        rag_loop_trace: traceFixture
      }
    })

    expect(summary.hasTrace).toBe(true)
    expect(summary.mode).toBe('shadow')
    expect(summary.ran).toBe(true)
    expect(summary.trigger).toBe('policy_prompt_select')
    expect(summary.strategy).toBe('auto')
    expect(summary.beforeScorePercent).toBe(42)
    expect(summary.afterScorePercent).toBe(67)
    expect(summary.events).toHaveLength(2)
  })

  it('returns safe defaults when trace is missing', () => {
    const summary = buildRagLoopTraceSummary({})
    expect(summary.hasTrace).toBe(false)
    expect(summary.events).toEqual([])
  })

  it('formats targeted re-check diagnostic line for queue cards', () => {
    const line = buildTargetedRecheckDiagnostic({
      classification_details: {
        rag_loop_trace: traceFixture
      }
    })

    expect(line).toContain('Targeted re-check ran')
    expect(line).toContain('42% -> 67%')
    expect(line).toContain('baseline kept (no stronger candidate was found)')
  })

  it('returns null diagnostic when trace is missing', () => {
    expect(buildTargetedRecheckDiagnostic({})).toBeNull()
  })
})
