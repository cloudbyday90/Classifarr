/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref, computed } from 'vue'
import SignalRow from '../../components/history/SignalRow.vue'

// Create a minimal test component that simulates the signal breakdown section
const createTestComponent = (selectedItemData) => {
  return defineComponent({
    components: { SignalRow },
    setup() {
      const selectedItem = ref(selectedItemData)
      
      const parsedMetadata = computed(() => {
        try {
          if (typeof selectedItem.value?.metadata === 'string') {
            return JSON.parse(selectedItem.value.metadata)
          }
          return selectedItem.value?.metadata || {}
        } catch {
          return {}
        }
      })

      const signalScores = computed(() => {
        return parsedMetadata.value?.classification_details?.scores || null
      })

      const signalWeights = computed(() => {
        return parsedMetadata.value?.classification_details?.weights || {
          preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10
        }
      })

      const ragSignalDetail = computed(() => {
        const details = parsedMetadata.value?.classification_details?.rag_details
        if (!details) return ''
        const parts = []
        if (Number.isFinite(details.combined_similarity)) {
          parts.push(`Combined ${Math.round(details.combined_similarity * 100)}%`)
        }
        if (Number.isFinite(details.text_similarity)) {
          parts.push(`Text ${Math.round(details.text_similarity * 100)}%`)
        }
        if (Number.isFinite(details.image_similarity)) {
          parts.push(`Image ${Math.round(details.image_similarity * 100)}%`)
        }
        if (Number.isFinite(details.text_weight) || Number.isFinite(details.image_weight)) {
          const textWeight = Number.isFinite(details.text_weight) ? details.text_weight : 0
          const imageWeight = Number.isFinite(details.image_weight) ? details.image_weight : 0
          parts.push(`W ${textWeight.toFixed(2)}/${imageWeight.toFixed(2)}`)
        }
        return parts.join(' â€¢ ')
      })

      const shouldShowSignalBreakdown = computed(() => {
        if (!signalScores.value) return false
        const hasNonZeroScore = Object.values(signalScores.value).some(score => score > 0)
        return hasNonZeroScore
      })

      return {
        selectedItem,
        signalScores,
        signalWeights,
        ragSignalDetail,
        shouldShowSignalBreakdown
      }
    },
    template: `
      <div>
        <div 
          v-if="shouldShowSignalBreakdown" 
          class="bg-background rounded-lg p-4 border border-gray-700"
          data-testid="signal-breakdown"
        >
          <h4 class="font-semibold mb-3 text-yellow-400">🔬 Classification Signals</h4>
          <div class="space-y-1">
            <SignalRow icon="⚙️" label="Preset"  :score="signalScores.preset"  :weight="signalWeights.preset" />
            <SignalRow icon="📊" label="Profile" :score="signalScores.profile" :weight="signalWeights.profile" />
            <SignalRow icon="📚" label="Pattern" :score="signalScores.pattern" :weight="signalWeights.pattern" />
            <SignalRow icon="🧠" label="RAG"     :score="signalScores.rag"     :weight="signalWeights.rag" :detail="ragSignalDetail" />
            <SignalRow icon="📖" label="History" :score="signalScores.history" :weight="signalWeights.history" />
          </div>
          <div class="mt-3 pt-3 border-t border-gray-700 flex justify-between">
            <span class="text-gray-400">Combined Score:</span>
            <span class="font-bold text-primary">{{ selectedItem.confidence }}%</span>
          </div>
        </div>
        <div v-else data-testid="no-signal-breakdown">No signal breakdown</div>
      </div>
    `
  })
}

describe('History View - Signal Breakdown', () => {
  describe('when classification_details exists with scores', () => {
    it('shows signal breakdown panel', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 75
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="no-signal-breakdown"]').exists()).toBe(false)
      expect(wrapper.find('h4').text()).toContain('Classification Signals')
    })

    it('renders all 5 signal rows', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 50, rag: 40, history: 30 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 65
      })
      
      const wrapper = mount(TestComponent)
      const signalRows = wrapper.findAllComponents(SignalRow)
      
      expect(signalRows).toHaveLength(5)
    })

    it('displays combined score from confidence value', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 85
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.text()).toContain('Combined Score:')
      expect(wrapper.text()).toContain('85%')
    })

    it('renders RAG details when rag_details are present', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 0, rag: 40, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 },
            rag_details: {
              combined_similarity: 0.91,
              text_similarity: 0.85,
              image_similarity: 0.95,
              text_weight: 0.6,
              image_weight: 0.4
            }
          }
        },
        confidence: 78
      })

      const wrapper = mount(TestComponent)
      const ragRow = wrapper.findAllComponents(SignalRow)[3]

      expect(ragRow.text()).toContain('Combined 91%')
      expect(ragRow.text()).toContain('Text 85%')
      expect(ragRow.text()).toContain('Image 95%')
      expect(ragRow.text()).toContain('W 0.60/0.40')
    })

    it('uses default weights when weights are missing', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 }
            // weights missing
          }
        },
        confidence: 75
      })
      
      const wrapper = mount(TestComponent)
      
      // Should still display (uses default weights)
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(true)
    })
  })

  describe('when classification_details is missing or has no scores', () => {
    it('hides signal breakdown when classification_details is missing', () => {
      const TestComponent = createTestComponent({
        metadata: {},
        confidence: 75
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="no-signal-breakdown"]').exists()).toBe(true)
    })

    it('hides signal breakdown when all scores are zero', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 0, profile: 0, pattern: 0, rag: 0, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 0
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="no-signal-breakdown"]').exists()).toBe(true)
    })

    it('hides signal breakdown when scores is null', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: null,
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 0
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(false)
    })
  })

  describe('signal display variations', () => {
    it('shows signal breakdown when only one engine has non-zero score', () => {
      const TestComponent = createTestComponent({
        metadata: {
          classification_details: {
            scores: { preset: 90, profile: 0, pattern: 0, rag: 0, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        },
        confidence: 90
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(true)
    })

    it('handles metadata as JSON string', () => {
      const TestComponent = createTestComponent({
        metadata: JSON.stringify({
          classification_details: {
            scores: { preset: 80, profile: 70, pattern: 0, rag: 0, history: 0 },
            weights: { preset: 0.35, profile: 0.25, pattern: 0.15, rag: 0.15, history: 0.10 }
          }
        }),
        confidence: 75
      })
      
      const wrapper = mount(TestComponent)
      
      expect(wrapper.find('[data-testid="signal-breakdown"]').exists()).toBe(true)
    })
  })
})

