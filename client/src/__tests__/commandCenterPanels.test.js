/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProcessingPanel from '@/components/command-center/ProcessingPanel.vue'
import CommandCenterOverviewSections from '@/components/command-center/CommandCenterOverviewSections.vue'

const buttonStub = {
  emits: ['click'],
  template: '<button @click="$emit(\'click\', $event)"><slot /></button>',
  props: ['disabled', 'loading', 'size', 'variant', 'ariaHaspopup'],
}

const processingHelpers = {
  completedPhaseCount: task => task?.phaseIndex || 0,
  formatDurationMs: value => `${value}ms`,
  formatMediaType: value => String(value || '').toUpperCase(),
  formatNumber: value => new Intl.NumberFormat('en-US').format(Number(value || 0)),
  isActionBusy: () => false,
  nextPhaseLabel: () => 'Metadata Fetch',
  phaseLabel: value => value,
  phaseRows: () => ([
    { name: 'queued', label: 'Queued', status: 'complete', timing: '10ms' },
    { name: 'metadata_fetch', label: 'Metadata Fetch', status: 'in_progress', timing: '120ms' },
  ]),
  safePercent: value => Math.round(Number(value || 0)),
  taskMediaType: task => task?.mediaType || task?.payload?.media?.media_type || 'movie',
  taskTitle: task => task?.title || task?.payload?.title || 'Unknown',
}

const overviewHelpers = {
  formatNumber: value => new Intl.NumberFormat('en-US').format(Number(value || 0)),
  formatPercentOrDash: value => value == null ? '—' : `${Math.round(Number(value))}%`,
  formatRelativeTime: () => 'just now',
  isActionBusy: () => false,
  safePercent: value => Math.round(Number(value || 0)),
  taskTitle: task => task?.title || 'Unknown',
  truncateError: message => message,
}

describe('CommandCenter extracted panels', () => {
  it('renders the processing panel active state and emits task actions', async () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        aiGenerationTelemetryLine: 'AI budget at 92%',
        aiOnline: true,
        gapPercentComplete: 45,
        gapProcessedCount: 2847,
        gapTotalCount: 6324,
        isMobileViewport: true,
        primaryActiveTask: {
          id: 12,
          taskId: 77,
          title: 'Inception',
          year: 2010,
          mediaType: 'movie',
          currentPhase: 'metadata_fetch',
          phaseIndex: 2,
          totalPhases: 8,
          progress: 34,
          phaseDuration: 120,
        },
        queuePendingCount: 3,
        upNextCount: 1,
        upNextTasks: [{ id: 91, title: 'The Bear', payload: { media: { media_type: 'tv' } } }],
      },
      global: {
        stubs: {
          Button: buttonStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Inception')
    expect(wrapper.text()).toContain('34%')
    expect(wrapper.text()).toContain('AI budget at 92%')
    expect(wrapper.text()).toContain('Up Next (1)')

    const buttons = wrapper.findAll('button')
    await buttons.find(node => node.text() === 'Cancel All').trigger('click')
    await buttons.find(node => node.text() === 'Cancel').trigger('click')
    await buttons.find(node => node.text() === 'View Details').trigger('click')

    expect(wrapper.emitted('cancel-all-pending')).toHaveLength(1)
    expect(wrapper.emitted('cancel-pending-task')).toEqual([[91]])
    expect(wrapper.emitted('open-processing-details')?.[0]?.[0]).toBe(77)
  })

  it('renders the waiting-for-ai idle state when work is queued but no task is active', () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        aiOnline: false,
        gapPercentComplete: 45,
        gapProcessedCount: 2847,
        gapTotalCount: 6324,
        primaryActiveTask: null,
        queuePendingCount: 2,
        upNextCount: 0,
        upNextTasks: [],
      },
      global: {
        stubs: {
          Button: buttonStub,
        },
      },
    })

    expect(wrapper.text()).toContain('Waiting for AI')
    expect(wrapper.text()).toContain('2 tasks queued but AI provider is offline')
  })

  it('renders overview sections and emits section-level actions', async () => {
    const wrapper = mount(CommandCenterOverviewSections, {
      props: {
        ...overviewHelpers,
        activeLibrariesSummary: [{ id: 10, name: 'TV Shows', itemCount: 2104, todayCount: 2, autoPercent: 50 }],
        configureMediaServerMessage: 'Connect a media server to restore full routing coverage.',
        enrichmentEnriched: 5621,
        enrichmentOmdb: 5418,
        enrichmentOmdbPending: 1,
        enrichmentProgress: 89,
        enrichmentTavily: 203,
        enrichmentTavilyPending: 2,
        enrichmentTotal: 6324,
        expandedSections: {
          errors: true,
          enrichment: true,
          recent: true,
          libraries: true,
          today: true,
        },
        failedQueueTasks: [{
          id: 77,
          task_type: 'classification',
          title: 'The Matrix 5',
          error_message: 'AI timeout',
          created_at: new Date().toISOString(),
        }],
        recentlyCompletedItems: [{
          id: 1,
          title: 'Toy Story 4',
          library: 'Kids Movies',
          confidence: 98,
          timestamp: new Date().toISOString(),
        }],
        showConfigureMediaServerCta: true,
        showEnrichmentSection: true,
        todayAvgConfidence: 89,
        todayClassifiedCount: 127,
        todayManualCount: 12,
      },
      global: {
        stubs: {
          Button: buttonStub,
          RouterLink: {
            props: ['to'],
            template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
          },
        },
      },
    })

    expect(wrapper.text()).toContain('Errors')
    expect(wrapper.text()).toContain('Retry OMDb (1)')
    expect(wrapper.text()).toContain('Retry Tavily (2)')
    expect(wrapper.text()).toContain('TV Shows')
    expect(wrapper.text()).toContain('127 classified')

    const buttons = wrapper.findAll('button')
    await buttons.find(node => node.text() === 'Retry All').trigger('click')
    await buttons.find(node => node.text() === 'Retry').trigger('click')
    await buttons.find(node => node.text() === 'Dismiss').trigger('click')
    await buttons.find(node => node.text().includes('Retry OMDb')).trigger('click')
    await buttons.find(node => node.text().includes('Retry Tavily')).trigger('click')
    await buttons.find(node => node.text() === 'Configure Media Server').trigger('click')

    await wrapper.find('#errors .secondary-section-header').trigger('click')

    expect(wrapper.emitted('retry-all-failed')).toHaveLength(1)
    expect(wrapper.emitted('retry-failed-task')).toEqual([[77]])
    expect(wrapper.emitted('dismiss-failed-task')).toEqual([[77]])
    expect(wrapper.emitted('process-enrichment-retries')).toEqual([['omdb'], ['tavily']])
    expect(wrapper.emitted('open-media-server-settings')).toHaveLength(1)
    expect(wrapper.emitted('toggle-section')).toEqual([['errors']])
  })
})
