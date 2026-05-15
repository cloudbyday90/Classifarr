/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import Logs from '@/views/settings/Logs.vue'
import api from '@/api'

vi.mock('@/api', () => ({
  default: {
    getLogStats: vi.fn(),
    getLogs: vi.fn(),
    exportLogs: vi.fn(),
    getLogError: vi.fn(),
    resolveLogError: vi.fn(),
    clearAllLogs: vi.fn(),
    cleanupLogs: vi.fn(),
    getBugReport: vi.fn(),
  }
}))

const baseStats = {
  totals: {
    total_logs: 10,
    unresolved_logs: 2
  },
  trends: {
    last24h: { logs_24h: 1 },
    last7d: { logs_7d: 5 }
  }
}

const defaultPagination = {
  page: 1,
  limit: 50,
  total: 1,
  totalPages: 1
}

describe('Settings Logs - retry audit trail filter', () => {
  let logParams

  beforeEach(() => {
    vi.clearAllMocks()
    logParams = []

    api.getLogStats.mockResolvedValue(baseStats)

    api.getLogs.mockImplementation((params) => {
      logParams.push(params.toString())
      return Promise.resolve({
        logs: [
          {
            id: 11,
            error_id: 'err-11',
            level: 'INFO',
            module: 'ClassificationRetryService',
            message: 'Classification retry queued',
            created_at: '2026-05-12T20:14:52',
            resolved: false,
            result: 'queued',
            reason_code: 'queued',
            correlation_id: 'corr-11'
          }
        ],
        pagination: defaultPagination
      })
    })

    api.exportLogs.mockResolvedValue([])
  })

  it('adds audit query and retry module default when Retry Audit Trail is enabled', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    expect(logParams.length).toBeGreaterThan(0)
    expect(logParams[0]).toContain('page=1')
    expect(logParams[0]).toContain('limit=50')
    expect(logParams[0]).not.toContain('audit=classification_retry')

    const toggleButton = wrapper.findAll('button').find((b) => b.text().includes('Retry Audit Trail'))
    expect(toggleButton).toBeTruthy()

    await toggleButton.trigger('click')
    await flushPromises()

    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('audit=classification_retry')
    expect(lastParams).toContain('module=ClassificationRetryService')

    const moduleInput = wrapper.find('input[placeholder="Filter by module..."]')
    expect(moduleInput.element.value).toBe('ClassificationRetryService')
  })

  it('shows retry columns only when Retry Audit Trail is enabled', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Correlation')

    const toggleButton = wrapper.findAll('button').find((b) => b.text().includes('Retry Audit Trail'))
    await toggleButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Result')
    expect(wrapper.text()).toContain('Reason')
    expect(wrapper.text()).toContain('Correlation')
    expect(wrapper.text()).toContain('queued')
    expect(wrapper.text()).toContain('corr-11')
  })

  it('formats log timestamps in month/day order for the logs table', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    expect(wrapper.text()).toContain('05/12/2026, 20:14:52')
    expect(wrapper.text()).not.toContain('12/05/2026, 20:14:52')
  })

  it('removes audit query and auto-set module when Retry Audit Trail is toggled off', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    const toggleButton = wrapper.findAll('button').find((b) => b.text().includes('Retry Audit Trail'))
    await toggleButton.trigger('click')
    await flushPromises()
    await toggleButton.trigger('click')
    await flushPromises()

    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).not.toContain('audit=classification_retry')
    expect(lastParams).not.toContain('module=ClassificationRetryService')

    const moduleInput = wrapper.find('input[placeholder="Filter by module..."]')
    expect(moduleInput.element.value).toBe('')
  })
})
