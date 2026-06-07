/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import {
  buildSignalSnapshot,
  formatPercentValue,
  hasPositiveSignalScores,
  resolveSignalSnapshotScore,
} from '@/utils/historySignalSnapshot'

describe('historySignalSnapshot', () => {
  it('detects whether persisted signal scores are present', () => {
    expect(hasPositiveSignalScores({ preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 })).toBe(false)
    expect(hasPositiveSignalScores({ preset: 0, profile: 0, pattern: 0, rag: 74, history: 0 })).toBe(true)
    expect(hasPositiveSignalScores(null)).toBe(false)
  })

  it('uses persisted calculated confidence ahead of final outcome confidence', () => {
    const score = resolveSignalSnapshotScore({
      selectedItem: { confidence: 100 },
      details: { calculated_confidence: 72 },
      hasFinalOutcome: true,
    })

    expect(score).toBe(72)
  })

  it('falls back to final row confidence only when there is no later final outcome', () => {
    const score = resolveSignalSnapshotScore({
      selectedItem: { confidence: 88 },
      details: {},
      hasFinalOutcome: false,
    })

    expect(score).toBe(88)
  })

  it('builds a separated snapshot for final manual outcomes', () => {
    const snapshot = buildSignalSnapshot({
      selectedItem: {
        id: 2,
        method: 'manual_classification',
        confidence: 100,
        library_name: 'Movies',
      },
      metadata: {
        classification_details: {
          calculated_confidence: 72,
          scores: { preset: 0, profile: 0, pattern: 0, rag: 74, history: 0 },
          weights: { rag: 0.15 },
        },
      },
      classificationEvents: [
        { id: 1, method: 'ai_rerun', confidence: 72, is_final: false },
        { id: 2, method: 'manual_classification', confidence: 100, is_final: true },
      ],
    })

    expect(snapshot.available).toBe(true)
    expect(snapshot.isOutcomeSeparated).toBe(true)
    expect(snapshot.score).toBe(72)
    expect(snapshot.sourceEvent.method).toBe('ai_rerun')
    expect(snapshot.finalEvent.method).toBe('manual_classification')
  })

  it('formats missing percentages as n/a', () => {
    expect(formatPercentValue(null)).toBe('n/a')
    expect(formatPercentValue(71.7)).toBe('72%')
  })
})
