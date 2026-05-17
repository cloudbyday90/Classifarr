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
        enrichmentTavilyDeferred: 4,
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
    expect(wrapper.text()).toContain('5,621 / 6,324 processed')
    expect(wrapper.text()).not.toContain('processed / deferred')
    expect(wrapper.text()).toContain('(+4 deferred)')
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

  it('hides the Tavily deferred note and counter when there are no deferred items', () => {
    const wrapper = mount(CommandCenterOverviewSections, {
      props: {
        ...overviewHelpers,
        activeLibrariesSummary: [],
        configureMediaServerMessage: '',
        enrichmentEnriched: 3930,
        enrichmentOmdb: 3930,
        enrichmentOmdbPending: 0,
        enrichmentProgress: 59,
        enrichmentTavily: 0,
        enrichmentTavilyDeferred: 0,
        enrichmentTavilyPending: 1,
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
    expect(wrapper.text()).not.toContain('(+0 deferred)')
    expect(wrapper.text()).not.toContain('waiting for the provider')
  })
})
