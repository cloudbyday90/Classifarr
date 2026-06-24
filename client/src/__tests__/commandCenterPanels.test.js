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
  formatNumber: value => new Intl.NumberFormat('en-US').format(Number(value || 0)),
  safePercent: value => Math.round(Number(value || 0)),
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
  it('renders the processing panel as active Plex sync coverage when a sync is running', () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        librarySyncCurrentLibrary: 'Movies',
        librarySyncIsRunning: true,
        librarySyncPercentComplete: 45,
        librarySyncProcessedCount: 2847,
        librarySyncRemainingCount: 3477,
        librarySyncTotalCount: 6324,
      },
    })

    expect(wrapper.text()).toContain('Syncing Plex Library')
    expect(wrapper.text()).toContain('45%')
    expect(wrapper.text()).toContain('Plex inventory import')
    expect(wrapper.text()).toContain('Current library: Movies')
    expect(wrapper.text()).toContain('3,477 waiting to sync')
    expect(wrapper.text()).toContain('Library: 2,847 / 6,324 (45%)')
  })

  it('renders the idle sync coverage snapshot when no Plex sync is running', () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        librarySyncCurrentLibrary: '',
        librarySyncIsRunning: false,
        librarySyncPercentComplete: 100,
        librarySyncProcessedCount: 6634,
        librarySyncRemainingCount: 0,
        librarySyncTotalCount: 6634,
      },
    })

    expect(wrapper.text()).toContain('No active processing')
    expect(wrapper.text()).toContain('Library: 6,634 / 6,634 (100%)')
  })

  it('renders active classification details when a task is in progress', () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        aiGenerationTelemetryLine: 'gpt-model - 120 tokens - 1.2s',
        completedPhaseCount: () => 3,
        formatMediaType: value => String(value || '').toUpperCase(),
        librarySyncCurrentLibrary: '',
        librarySyncIsRunning: false,
        librarySyncPercentComplete: 100,
        librarySyncProcessedCount: 6634,
        librarySyncRemainingCount: 0,
        librarySyncTotalCount: 6634,
        nextPhaseLabel: () => 'Signal Combination',
        primaryActiveTask: {
          id: 55,
          title: 'Spider-Verse',
          currentPhase: 'rag_analysis',
          media_type: 'movie',
        },
        queuePendingCount: 4,
        taskMediaType: task => task.media_type,
        taskTitle: task => task.title,
        upNextCount: 4,
        upNextTasks: [{ id: 101, title: 'Toy Story 2' }, { id: 102, title: 'Inside Out 2' }],
      },
    })

    expect(wrapper.text()).toContain('Classifying Now')
    expect(wrapper.text()).toContain('Spider-Verse')
    expect(wrapper.text()).toContain('Current phase: Rag Analysis')
    expect(wrapper.text()).toContain('Media: MOVIE')
    expect(wrapper.text()).toContain('Pending queue: 4')
    expect(wrapper.text()).toContain('Up next (4)')
    expect(wrapper.text()).toContain('Toy Story 2')
  })

  it('renders queued state when no active task is available but queue has pending items', () => {
    const wrapper = mount(ProcessingPanel, {
      props: {
        ...processingHelpers,
        librarySyncCurrentLibrary: '',
        librarySyncIsRunning: false,
        librarySyncPercentComplete: 100,
        librarySyncProcessedCount: 6634,
        librarySyncRemainingCount: 0,
        librarySyncTotalCount: 6634,
        primaryActiveTask: null,
        queuePendingCount: 2,
        taskTitle: task => task.title,
        upNextCount: 2,
        upNextTasks: [{ id: 201, title: 'Coco' }],
      },
    })

    expect(wrapper.text()).toContain('Queue Waiting')
    expect(wrapper.text()).toContain('2 queued classification tasks waiting for a worker.')
    expect(wrapper.text()).toContain('Up next')
    expect(wrapper.text()).toContain('Coco')
    expect(wrapper.text()).not.toContain('No active processing')
  })

  it('renders overview sections and emits section-level actions', async () => {
    const wrapper = mount(CommandCenterOverviewSections, {
      props: {
        ...overviewHelpers,
        activeLibrariesSummary: [{ id: 10, name: 'TV Shows', itemCount: 2104, todayCount: 2, autoPercent: 50 }],
        configureMediaServerMessage: 'Connect a media server to restore full routing coverage.',
        enrichmentCompletedItems: 5621,
        enrichmentDeferredItems: 4,
        enrichmentEnriched: 5621,
        enrichmentFailedItems: 1,
        enrichmentOmdb: 5418,
        enrichmentOmdbPending: 1,
        enrichmentPendingItems: 12,
        enrichmentProcessingItems: 5,
        enrichmentProgress: 89,
        enrichmentWebSearch: 203,
        enrichmentWebSearchDeferred: 4,
        enrichmentWebSearchPending: 2,
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
    expect(wrapper.text()).toContain('Retry Web Search (2)')
    expect(wrapper.text()).toContain('5,621 / 6,324 processed')
    expect(wrapper.text()).not.toContain('processed / deferred')
    expect(wrapper.text()).toContain('Processed')
    expect(wrapper.text()).toContain('Processing')
    expect(wrapper.text()).toContain('Pending')
    expect(wrapper.text()).toContain('Deferred')
    expect(wrapper.text()).toContain('Failed')
    expect(wrapper.text()).toContain('(+4 deferred)')
    expect(wrapper.text()).toContain('TV Shows')
    expect(wrapper.text()).toContain('127 classified')

    const buttons = wrapper.findAll('button')
    await buttons.find(node => node.text() === 'Retry All').trigger('click')
    await buttons.find(node => node.text() === 'Retry').trigger('click')
    await buttons.find(node => node.text() === 'Dismiss').trigger('click')
    await buttons.find(node => node.text().includes('Retry OMDb')).trigger('click')
    await buttons.find(node => node.text().includes('Retry Web Search')).trigger('click')
    await buttons.find(node => node.text() === 'Configure Media Server').trigger('click')

    await wrapper.find('#errors .secondary-section-header').trigger('click')

    expect(wrapper.emitted('retry-all-failed')).toHaveLength(1)
    expect(wrapper.emitted('retry-failed-task')).toEqual([[77]])
    expect(wrapper.emitted('dismiss-failed-task')).toEqual([[77]])
    expect(wrapper.emitted('process-enrichment-retries')).toEqual([['omdb'], ['web_search']])
    expect(wrapper.emitted('open-media-server-settings')).toHaveLength(1)
    expect(wrapper.emitted('toggle-section')).toEqual([['errors']])
  })

  it('hides the Tavily deferred note and counter when there are no deferred items', () => {
    const wrapper = mount(CommandCenterOverviewSections, {
      props: {
        ...overviewHelpers,
        activeLibrariesSummary: [],
        configureMediaServerMessage: '',
        enrichmentCompletedItems: 3930,
        enrichmentDeferredItems: 0,
        enrichmentEnriched: 3930,
        enrichmentFailedItems: 0,
        enrichmentOmdb: 3930,
        enrichmentOmdbPending: 0,
        enrichmentPendingItems: 6,
        enrichmentProcessingItems: 2,
        enrichmentProgress: 59,
        enrichmentWebSearch: 0,
        enrichmentWebSearchDeferred: 0,
        enrichmentWebSearchPending: 1,
        enrichmentTotal: 6634,
        expandedSections: {
          errors: false,
          enrichment: true,
          recent: false,
          libraries: false,
          today: false,
        },
        failedQueueTasks: [],
        recentlyCompletedItems: [],
        showConfigureMediaServerCta: false,
        showEnrichmentSection: true,
        todayAvgConfidence: 0,
        todayClassifiedCount: 0,
        todayManualCount: 0,
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

    expect(wrapper.text()).toContain('3,930 / 6,634 processed')
    expect(wrapper.text()).toContain('Deferred')
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).not.toContain('(+0 deferred)')
    expect(wrapper.text()).not.toContain('waiting for the provider')
  })
})
