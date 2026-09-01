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

const { mockRoute, mockRouter } = vi.hoisted(() => ({
  mockRoute: { query: {} },
  mockRouter: { replace: vi.fn() },
}))

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

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}))

beforeEach(() => {
  mockRoute.query = {}
  mockRouter.replace.mockReset()
  mockRouter.replace.mockResolvedValue(undefined)
})

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

describe('Settings Logs - capability telemetry handoff', () => {
  beforeEach(() => {
    mockRoute.query = {
      tab: 'logs',
      handoff: 'capability-metrics-persistence',
      reasonCode: 'ai_provider_capability_metrics_persistence_failed',
    }
    api.getLogStats.mockResolvedValue(baseStats)
    api.getLogs.mockResolvedValue({ logs: [], pagination: defaultPagination })
  })

  it('applies only the fixed reason-code filter from the AI Settings handoff', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    expect(wrapper.text()).toContain('Capability telemetry persistence warnings')
    expect(api.getLogs).toHaveBeenCalledWith(expect.any(URLSearchParams))
    const [params] = api.getLogs.mock.calls.at(-1)
    expect(params.get('reasonCode')).toBe('ai_provider_capability_metrics_persistence_failed')
    expect(params.get('handoff')).toBeNull()
    expect(params.get('provider')).toBeNull()
  })

  it('does not pre-filter from incomplete or altered URL state', async () => {
    mockRoute.query = {
      tab: 'logs',
      handoff: 'capability-metrics-persistence',
      reasonCode: 'untrusted_reason_code',
    }

    const wrapper = mount(Logs)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Capability telemetry persistence warnings')
    const [params] = api.getLogs.mock.calls.at(-1)
    expect(params.get('reasonCode')).toBeNull()
  })

  it('removes the handoff query with the visible clear action', async () => {
    const wrapper = mount(Logs)
    await flushPromises()

    const clearButton = wrapper.findAll('button').find((button) => button.text() === 'Clear handoff filter')
    await clearButton.trigger('click')

    expect(mockRouter.replace).toHaveBeenCalledWith({ query: { tab: 'logs' } })
  })
})

const sampleLogs = [
  {
    id: 1,
    error_id: 'err-1',
    level: 'ERROR',
    module: 'TestModule',
    message: 'Something went wrong',
    created_at: '2026-05-12T20:14:52',
    resolved: false
  },
  {
    id: 2,
    error_id: 'err-2',
    level: 'WARN',
    module: 'OtherModule',
    message: 'Warning issued',
    created_at: '2026-05-13T10:30:00',
    resolved: true
  }
]

const uniqueStats = {
  totals: { total_logs: 42, unresolved_logs: 7 },
  trends: { last24h: { logs_24h: 99 }, last7d: { logs_7d: 88 } }
}

const multiPagePagination = {
  page: 1,
  limit: 50,
  total: 100,
  totalPages: 3
}

describe('Stats dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
  })

  it('renders all stat values from API response', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('Total Logs')
    expect(wrapper.text()).toContain('Unresolved')
    expect(wrapper.text()).toContain('Last 24h')
    expect(wrapper.text()).toContain('Last 7d')
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('7')
    expect(wrapper.text()).toContain('99')
    expect(wrapper.text()).toContain('88')
  })
})

describe('Log table rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
  })

  it('renders log entries with level, module, message, and status', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('ERROR')
    expect(wrapper.text()).toContain('WARN')
    expect(wrapper.text()).toContain('TestModule')
    expect(wrapper.text()).toContain('OtherModule')
    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('Warning issued')
    expect(wrapper.text()).toContain('Open')
    expect(wrapper.text()).toContain('Resolved')
  })

  it('applies level CSS classes via getLevelClass', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const html = wrapper.html()
    expect(html).toContain('bg-red-900/30 text-red-400')
    expect(html).toContain('bg-yellow-900/30 text-yellow-400')
  })

  it('renders formatted timestamps in table rows', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('05/12/2026, 20:14:52')
    expect(wrapper.text()).toContain('05/13/2026, 10:30:00')
  })
})

describe('Filter by level', () => {
  let logParams

  beforeEach(() => {
    vi.clearAllMocks()
    logParams = []
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockImplementation((params) => {
      logParams.push(params.toString())
      return Promise.resolve({ logs: sampleLogs, pagination: defaultPagination })
    })
  })

  it('sends level filter when level select is changed to ERROR', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const levelSelect = wrapper.findAll('select')[0]
    await levelSelect.setValue('ERROR')
    await flushPromises()
    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('level=ERROR')
  })

  it('sends level filter when level select is changed to WARN', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const levelSelect = wrapper.findAll('select')[0]
    await levelSelect.setValue('WARN')
    await flushPromises()
    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('level=WARN')
  })
})

describe('Filter by module', () => {
  let logParams

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    logParams = []
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockImplementation((params) => {
      logParams.push(params.toString())
      return Promise.resolve({ logs: sampleLogs, pagination: defaultPagination })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces module filter input by 500ms', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const moduleInput = wrapper.find('input[placeholder="Filter by module..."]')
    await moduleInput.setValue('TestModule')
    await flushPromises()
    const countBeforeDebounce = logParams.length
    vi.advanceTimersByTime(499)
    await flushPromises()
    expect(logParams.length).toBe(countBeforeDebounce)
    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(logParams.length).toBe(countBeforeDebounce + 1)
    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('module=TestModule')
  })
})

describe('Filter by resolved status', () => {
  let logParams

  beforeEach(() => {
    vi.clearAllMocks()
    logParams = []
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockImplementation((params) => {
      logParams.push(params.toString())
      return Promise.resolve({ logs: sampleLogs, pagination: defaultPagination })
    })
  })

  it('sends resolved=false filter for unresolved', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const resolvedSelect = wrapper.findAll('select')[1]
    await resolvedSelect.setValue('false')
    await flushPromises()
    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('resolved=false')
  })

  it('sends resolved=true filter for resolved', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const resolvedSelect = wrapper.findAll('select')[1]
    await resolvedSelect.setValue('true')
    await flushPromises()
    const lastParams = logParams[logParams.length - 1]
    expect(lastParams).toContain('resolved=true')
  })
})

describe('Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: multiPagePagination })
  })

  it('shows pagination controls when totalPages > 1', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('Page 1 of 3')
    expect(wrapper.text()).toContain('Previous')
    expect(wrapper.text()).toContain('Next')
  })

  it('disables previous button on first page', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const prevButton = wrapper.findAll('button').find(b => b.text() === 'Previous')
    expect(prevButton.attributes('disabled')).toBeDefined()
  })

  it('calls changePage when next button is clicked', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const nextButton = wrapper.findAll('button').find(b => b.text() === 'Next')
    await nextButton.trigger('click')
    await flushPromises()
    expect(api.getLogs).toHaveBeenCalledTimes(2)
  })
})

describe('Error state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockRejectedValue(new Error('Network error'))
  })

  it('shows error message when loadLogs fails', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('Failed to load logs')
    expect(wrapper.text()).toContain('Network error')
  })
})

describe('Loading state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
  })

  it('shows loading indicator during load', async () => {
    let resolveLogs
    api.getLogs.mockReturnValue(new Promise(r => { resolveLogs = r }))
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('Loading logs...')
    resolveLogs({ logs: [], pagination: defaultPagination })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Loading logs...')
  })
})

describe('Empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: [], pagination: defaultPagination })
  })

  it('shows no logs found when logs array is empty', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    expect(wrapper.text()).toContain('No logs found')
  })
})

describe('viewDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.getLogError.mockResolvedValue({
      error_id: 'err-1',
      level: 'ERROR',
      module: 'TestModule',
      message: 'Something went wrong',
      created_at: '2026-05-12T20:14:52',
      resolved: false,
      stack_trace: 'Error at line 1\n  at test.js:5',
      request_context: { url: '/api/test' }
    })
  })

  it('calls getLogError and opens modal with details', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const viewButton = wrapper.findAll('button').find(b => b.text() === 'View')
    await viewButton.trigger('click')
    await flushPromises()
    expect(api.getLogError).toHaveBeenCalledWith('err-1')
    expect(wrapper.text()).toContain('Error Details')
    expect(wrapper.text()).toContain('err-1')
    expect(wrapper.text()).toContain('Error at line 1')
    expect(wrapper.text()).toContain('/api/test')
    expect(wrapper.text()).toContain('Mark as Resolved')
  })
})

describe('resolveError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.getLogError.mockResolvedValue({
      error_id: 'err-1',
      level: 'ERROR',
      module: 'TestModule',
      message: 'Something went wrong',
      created_at: '2026-05-12T20:14:52',
      resolved: false
    })
    api.resolveLogError.mockResolvedValue({})
  })

  it('resolves error, closes modal, and reloads logs and stats', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const viewButton = wrapper.findAll('button').find(b => b.text() === 'View')
    await viewButton.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Error Details')
    const resolveButton = wrapper.findAll('button').find(b => b.text() === 'Mark as Resolved')
    await resolveButton.trigger('click')
    await flushPromises()
    expect(api.resolveLogError).toHaveBeenCalledWith('err-1')
    expect(api.getLogs).toHaveBeenCalledTimes(2)
    expect(api.getLogStats).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('Error Details')
  })
})

describe('clearAllLogs', () => {
  let confirmSpy
  let alertSpy

  beforeEach(() => {
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    alertSpy = vi.spyOn(window, 'alert').mockReturnValue(undefined)
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.clearAllLogs.mockResolvedValue({
      data: { deleted: { errorLogs: 5, appLogs: 3 } }
    })
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('confirms then clears all logs and reloads', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const clearButton = wrapper.findAll('button').find(b => b.text() === 'Clear All')
    await clearButton.trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete ALL logs? This cannot be undone.')
    expect(api.clearAllLogs).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Cleared all logs. Deleted 5 error logs and 3 app logs.')
    expect(api.getLogs).toHaveBeenCalledTimes(2)
    expect(api.getLogStats).toHaveBeenCalledTimes(2)
  })

  it('does nothing when user cancels confirmation', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = mount(Logs)
    await flushPromises()
    const clearButton = wrapper.findAll('button').find(b => b.text() === 'Clear All')
    await clearButton.trigger('click')
    await flushPromises()
    expect(api.clearAllLogs).not.toHaveBeenCalled()
  })
})

describe('cleanupLogs', () => {
  let confirmSpy
  let alertSpy

  beforeEach(() => {
    vi.clearAllMocks()
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    alertSpy = vi.spyOn(window, 'alert').mockReturnValue(undefined)
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.cleanupLogs.mockResolvedValue({
      data: { deleted: { errorLogs: 2, appLogs: 1 } }
    })
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    alertSpy.mockRestore()
  })

  it('confirms then prunes old logs and reloads', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const pruneButton = wrapper.findAll('button').find(b => b.text() === 'Prune Old')
    await pruneButton.trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledWith('This will delete old logs based on retention settings. Continue?')
    expect(api.cleanupLogs).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('Cleanup completed. Deleted 2 error logs and 1 app logs.')
    expect(api.getLogs).toHaveBeenCalledTimes(2)
    expect(api.getLogStats).toHaveBeenCalledTimes(2)
  })

  it('does nothing when user cancels confirmation', async () => {
    confirmSpy.mockReturnValue(false)
    const wrapper = mount(Logs)
    await flushPromises()
    const pruneButton = wrapper.findAll('button').find(b => b.text() === 'Prune Old')
    await pruneButton.trigger('click')
    await flushPromises()
    expect(api.cleanupLogs).not.toHaveBeenCalled()
  })
})

describe('exportLogs', () => {
  let createObjectURLSpy
  let revokeObjectURLSpy
  let originalCreateObjectURL
  let originalRevokeObjectURL
  let anchorClickSpy

  beforeEach(() => {
    vi.clearAllMocks()
    originalCreateObjectURL = window.URL.createObjectURL
    originalRevokeObjectURL = window.URL.revokeObjectURL
    createObjectURLSpy = vi.fn().mockReturnValue('blob:http://test')
    revokeObjectURLSpy = vi.fn()
    window.URL.createObjectURL = createObjectURLSpy
    window.URL.revokeObjectURL = revokeObjectURLSpy
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.exportLogs.mockResolvedValue([{ id: 1, message: 'test' }])
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
    anchorClickSpy.mockRestore()
  })

  it('calls exportLogs and triggers blob download', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const exportButton = wrapper.findAll('button').find(b => b.text() === 'Export JSON')
    await exportButton.trigger('click')
    await flushPromises()
    expect(api.exportLogs).toHaveBeenCalled()
    expect(createObjectURLSpy).toHaveBeenCalled()
  })
})

describe('copyBugReport', () => {
  let clipboardSpy
  let originalClipboard
  let originalIsSecureContext

  beforeEach(() => {
    vi.clearAllMocks()
    originalClipboard = navigator.clipboard
    originalIsSecureContext = window.isSecureContext
    clipboardSpy = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardSpy },
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true
    })
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.getLogError.mockResolvedValue({
      error_id: 'err-1',
      level: 'ERROR',
      module: 'TestModule',
      message: 'Something went wrong',
      created_at: '2026-05-12T20:14:52',
      resolved: false
    })
    api.getBugReport.mockResolvedValue({ report: 'Bug report content here' })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true
    })
    Object.defineProperty(window, 'isSecureContext', {
      value: originalIsSecureContext,
      configurable: true
    })
  })

  it('copies bug report to clipboard and shows success message', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const viewButton = wrapper.findAll('button').find(b => b.text() === 'View')
    await viewButton.trigger('click')
    await flushPromises()
    const copyButton = wrapper.findAll('button').find(b => b.text() === 'Copy Bug Report')
    await copyButton.trigger('click')
    await flushPromises()
    expect(api.getBugReport).toHaveBeenCalledWith('err-1')
    expect(clipboardSpy).toHaveBeenCalledWith('Bug report content here')
    expect(wrapper.text()).toContain('Bug report copied to clipboard!')
  })
})

describe('closeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getLogStats.mockResolvedValue(uniqueStats)
    api.getLogs.mockResolvedValue({ logs: sampleLogs, pagination: defaultPagination })
    api.getLogError.mockResolvedValue({
      error_id: 'err-1',
      level: 'ERROR',
      module: 'TestModule',
      message: 'Something went wrong',
      created_at: '2026-05-12T20:14:52',
      resolved: false
    })
  })

  it('closes modal and resets state when close button is clicked', async () => {
    const wrapper = mount(Logs)
    await flushPromises()
    const viewButton = wrapper.findAll('button').find(b => b.text() === 'View')
    await viewButton.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Error Details')
    const xButton = wrapper.findAll('button').find(b => b.classes('text-gray-400'))
    await xButton.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('Error Details')
  })
})
