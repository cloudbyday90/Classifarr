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

import { describe, expect, it } from 'vitest'
import { buildRagLoopTraceSummary, buildTargetedRecheckDiagnostic } from '@/utils/ragLoopUi'

function makeMetadata(similarity1, similarity2) {
  return {
    classification_details: {
      rag_loop_trace: {
        mode: 'active',
        ran: true,
        trigger: 'low_confidence',
        strategy: 'targeted_recheck',
        decision: { outcome: 'pass2', reason: 'improved' },
        diagnostics: {
          pass1: { top_similarity: similarity1 },
          pass2: { top_similarity: similarity2 },
        },
        events: [],
      },
    },
  }
}

describe('ragLoopUi — toPercentFromSimilarity branch coverage', () => {
  it('converts a similarity value in 0-100 range (not 0-1) to a rounded percent', () => {
    const result = buildRagLoopTraceSummary(makeMetadata(75.4, 42.7))

    expect(result.beforeScorePercent).toBe(75)
    expect(result.afterScorePercent).toBe(43)
    expect(result.hasTrace).toBe(true)
  })

  it('returns null for similarity values outside both 0-1 and 0-100 ranges', () => {
    const result = buildRagLoopTraceSummary(makeMetadata(200, -5))

    expect(result.beforeScorePercent).toBeNull()
    expect(result.afterScorePercent).toBeNull()
  })

  it('buildTargetedRecheckDiagnostic shows skipped with unavailable scores for baseline outcome', () => {
    const metadata = {
      classification_details: {
        rag_loop_trace: {
          mode: 'shadow',
          ran: false,
          trigger: null,
          strategy: null,
          decision: { outcome: 'baseline', comparator: 'below_threshold' },
          diagnostics: {},
          events: [],
        },
      },
    }

    const diagnostic = buildTargetedRecheckDiagnostic(metadata)

    expect(diagnostic).toBe('Targeted re-check skipped: before/after unavailable; skipped (below_threshold)')
  })
})
