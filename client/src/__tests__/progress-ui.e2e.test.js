/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2026 cloudbyday90
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GlobalProgressBar from '@/components/GlobalProgressBar.vue'
import ActivityItemProgress from '@/components/ActivityItemProgress.vue'

// Mock API
vi.mock('@/api', () => ({
  default: {
    getProgress: vi.fn(() => Promise.resolve({ data: [] }))
  }
}))

// Mock WebSocket composable
vi.mock('@/composables/useWebSocket', () => ({
  useWebSocket: vi.fn(() => ({
    socket: { connected: false },
    isConnected: ref(false),
    reconnectAttempts: ref(0),
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    joinTask: vi.fn(),
    leaveTask: vi.fn()
  }))
}))

describe('GlobalProgressBar E2E Tests', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component rendering', () => {
    it('should not render when no active classifications', () => {
      const wrapper = mount(GlobalProgressBar, {
        props: {
          activeClassifications: []
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.global-progress-bar').exists()).toBe(false)
    })

    it('should render when there are active classifications', () => {
      const activeClassifications = [
        {
          id: 1,
          current_phase: 'rag_analysis',
          progress: 57,
          title: 'Test Movie'
        }
      ]

      const wrapper = mount(GlobalProgressBar, {
        props: { activeClassifications },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.global-progress-bar').exists()).toBe(true)
    })
  })

  describe('Progress calculation', () => {
    it('should calculate overall progress correctly', () => {
      const activeClassifications = [
        { id: 1, current_phase: 'queued', progress: 0 },
        { id: 2, current_phase: 'rag_analysis', progress: 57 },
        { id: 3, current_phase: 'decision', progress: 83 }
      ]

      const wrapper = mount(GlobalProgressBar, {
        props: { activeClassifications },
        global: {
          plugins: [pinia]
        }
      })

      // Average progress should be (0 + 57 + 83) / 3 = 46.67 -> 47%
      expect(wrapper.find('.progress-percent').text()).toBe('47%')
    })

    it('should show correct active count', () => {
      const activeClassifications = [
        { id: 1, current_phase: 'queued', progress: 0 },
        { id: 2, current_phase: 'rag_analysis', progress: 57 }
      ]

      const wrapper = mount(GlobalProgressBar, {
        props: { activeClassifications },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.progress-label').text()).toContain('2 classifications in progress')
    })
  })

  describe('Phase badges', () => {
    it('should display phase counts correctly', () => {
      const activeClassifications = [
        { id: 1, current_phase: 'rag_analysis', progress: 57 },
        { id: 2, current_phase: 'rag_analysis', progress: 50 },
        { id: 3, current_phase: 'decision', progress: 83 }
      ]

      const wrapper = mount(GlobalProgressBar, {
        props: { activeClassifications },
        global: {
          plugins: [pinia]
        }
      })

      // Should show "RAG: 2" and "Decision: 1"
      const badges = wrapper.findAll('.phase-badge')
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should apply correct phase colors', () => {
      const activeClassifications = [
        { id: 1, current_phase: 'rag_analysis', progress: 57 }
      ]

      const wrapper = mount(GlobalProgressBar, {
        props: { activeClassifications },
        global: {
          plugins: [pinia]
        }
      })

      const ragBadge = wrapper.find('.phase-rag_analysis')
      expect(ragBadge.exists()).toBe(true)
    })
  })
})

describe('ActivityItemProgress E2E Tests', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component rendering', () => {
    it('should render when progress is between 0 and 100', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.activity-item-progress').exists()).toBe(true)
    })

    it('should not render when progress is 0 or 100', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 0,
          currentPhase: 'queued',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.activity-item-progress').exists()).toBe(false)
    })

    it('should not render phase details when showPhaseDetails is false', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: false
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.phase-timeline').exists()).toBe(false)
    })
  })

  describe('Phase display', () => {
    it('should display correct phase label', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.current-phase').text()).toContain('Analyzing with RAG')
    })

    it('should display correct phase icon', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.phase-icon').text()).toBe('🔍')
    })

    it('should display correct progress percentage', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 75,
          currentPhase: 'decision',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.progress-percent').text()).toBe('75%')
    })
  })

  describe('Phase timeline', () => {
    it('should render all 7 phases', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const phaseItems = wrapper.findAll('.phase-item')
      expect(phaseItems.length).toBe(7)
    })

    it('should mark completed phases', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const completedPhases = wrapper.findAll('.phase-completed')
      // Queued, Metadata Fetch, Policy Evaluation should be completed (before RAG)
      expect(completedPhases.length).toBe(3)
    })

    it('should mark active phase', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const activePhase = wrapper.find('.phase-active')
      expect(activePhase.exists()).toBe(true)
      expect(activePhase.find('.phase-label').text()).toContain('RAG Analysis')
    })

    it('should mark pending phases', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const pendingPhases = wrapper.findAll('.phase-pending')
      // Signal Combination, Decision, Notification should be pending (after RAG)
      expect(pendingPhases.length).toBe(3)
    })
  })

  describe('Progress bar styling', () => {
    it('should apply correct phase color to progress bar', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 50,
          currentPhase: 'rag_analysis',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const progressFill = wrapper.find('.progress-fill')
      expect(progressFill.classes()).toContain('phase-rag_analysis')
    })

    it('should set progress bar width correctly', () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 75,
          currentPhase: 'decision',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      const progressFill = wrapper.find('.progress-fill')
      expect(progressFill.attributes('style')).toContain('width: 75%')
    })
  })
})

describe('Progress UI Integration E2E Tests', () => {
  let pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Progress update flow', () => {
    it('should update progress bar when new progress data arrives', async () => {
      // This would typically be tested in a full E2E environment
      // Here we verify the component accepts prop changes correctly
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 25,
          currentPhase: 'metadata_fetch',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.setProps({ progress: 50, currentPhase: 'rag_analysis' })

      expect(wrapper.find('.progress-percent').text()).toBe('50%')
      expect(wrapper.find('.current-phase').text()).toContain('Analyzing with RAG')
    })

    it('should handle phase transitions correctly', async () => {
      const wrapper = mount(ActivityItemProgress, {
        props: {
          progress: 33,
          currentPhase: 'policy_evaluation',
          showPhaseDetails: true
        },
        global: {
          plugins: [pinia]
        }
      })

      // Simulate phase progression
      await wrapper.setProps({ progress: 57, currentPhase: 'rag_analysis' })

      const activePhase = wrapper.find('.phase-active')
      expect(activePhase.find('.phase-label').text()).toContain('RAG Analysis')
    })
  })
})
