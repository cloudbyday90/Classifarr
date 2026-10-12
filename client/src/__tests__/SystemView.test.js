/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SystemView from '../views/System.vue'
import api from '../api'

vi.mock('../api', () => ({
  default: {
    getAIConfig: vi.fn(),
    getSystemHealth: vi.fn(),
    getSystemStatus: vi.fn(),
    refreshSystemHealth: vi.fn()
  }
}))

vi.mock('@heroicons/vue/24/outline', () => ({
  ArrowPathIcon: { template: '<span />' }
}))

const fresh = { state: 'fresh', reason: 'within_budget', ageMs: 0, maxAgeMs: 930000,
  checkedAt: '2026-10-12T12:00:00.000Z', expiresAt: '2026-10-12T12:15:30.000Z' }
const baseHealth = {
  database: 'connected',
  rag: 'degraded',
  mediaServer: 'connected',
  radarr: 'not configured',
  sonarr: 'not configured',
  ollama: 'connected',
  tmdb: 'connected',
  omdb: 'connected',
  discordBot: 'not configured',
  tavily: 'not configured',
  queueWorker: 'healthy',
  details: {
    database: { responseTime: 5, lastCheck: '2026-01-30T12:00:00Z' },
    rag: {
      lastCheck: '2026-01-30T12:00:00Z',
      lastSuccessfulCheck: '2026-01-30T11:55:00Z',
      pgvector: true,
      embeddingsTable: true,
      prewarm: true,
      indexes: { text: true, image: false, imageRequired: true, missing: ['image'] },
      embeddingCount: 42,
      staleCount: 3,
      provider: 'local',
      model: 'nomic'
    },
    mediaServer: { responseTime: 10, lastCheck: '2026-01-30T12:00:00Z', type: 'Plex' },
    queueWorker: { latency: 0, timestamp: '2026-01-30T12:00:00Z' }
  }
}
baseHealth.freshnessPolicy = { intervalMs: 900000, graceMs: 30000, heartbeatActive: true }
for (const key of ['database', 'rag', 'mediaServer', 'ollama', 'tmdb', 'omdb', 'queueWorker']) {
  baseHealth.details[key] = { ...baseHealth.details[key], freshness: fresh }
}

const baseStatus = {
  version: '1.0.0',
  uptime: 120,
  nodeVersion: 'v20.0.0',
  platform: 'linux',
  arch: 'x64',
  memoryUsage: { heapUsed: 1024 },
  pgvector: null
}

const currentPgvector = {
  selection: {
    status: 'current_process',
    report: {
      schemaVersion: 1, databaseScope: 'embedded_entrypoint', build: 'multi',
      selectedVariant: 'avx2', cpuAvx: 'true', cpuAvx2: 'true',
    },
  },
}

describe('System.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mountSystem = async (statusOverrides = {}, health = baseHealth) => {
    api.getAIConfig.mockResolvedValue({})
    api.getSystemHealth.mockResolvedValue(health)
    api.getSystemStatus.mockResolvedValue({ ...baseStatus, ...statusOverrides })

    const wrapper = mount(SystemView, {
      global: {
        stubs: {
          ImageIndexProgressCard: true,
          Card: { template: '<div><slot name="header" /><slot /></div>' },
          Badge: { template: '<span><slot /></span>' },
          Button: { template: '<button><slot /></button>' },
          Spinner: { template: '<div />' }
        },
        directives: {
          tooltip: {
            mounted() {},
            updated() {}
          }
        }
      }
    })

    await flushPromises()
    return wrapper
  }

  it('separates a reported CPU match from operational service counts', async () => {
    const wrapper = await mountSystem({ pgvector: currentPgvector })
    expect(wrapper.find('[data-testid="service-card-pgvector"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="service-card-"]')).toHaveLength(12)
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toBe('CPU match reported at startup')
    expect(wrapper.get('[data-testid="service-card-rag"]').text()).toContain('Degraded')
    expect(wrapper.text()).toContain('of 8 active services reported healthy')
    wrapper.unmount()
  })

  it('renders rag card with degraded readiness details', async () => {
    const wrapper = await mountSystem()

    const card = wrapper.find('[data-testid="service-card-rag"]')
    expect(card.exists()).toBe(true)
    expect(card.text()).toContain('RAG')
    expect(card.text()).toContain('Degraded')
    expect(card.text()).toContain('Embeddings: 42')
    expect(card.text()).toContain('Unavailable indexes: image')

    wrapper.unmount()
  })

  it('shows configuration-read failure context without inventing absent configuration or RAG counts', async () => {
    const failure = { stage: 'configuration_read', code: 'configuration_schema_unavailable' }
    const lastCheck = '2026-10-12T12:00:00.000Z'
    const unknown = { status: 'unknown', lastCheck, failure, freshness: fresh,
      error: 'Review startup and migration logs; do not re-enter provider credentials.',
      lastSuccessfulCheck: '2026-10-11T12:00:00.000Z' }
    const wrapper = await mountSystem({}, { ...baseHealth, radarr: 'unknown', rag: 'unknown', imageEmbeddings: 'unknown',
      details: { ...baseHealth.details, radarr: unknown, rag: unknown, imageEmbeddings: unknown } })
    for (const key of ['radarr', 'rag', 'imageEmbeddings']) {
      const card = wrapper.get(`[data-testid="service-card-${key}"]`)
      expect(card.text()).toContain('Unknown')
      expect(card.text()).toContain('do not re-enter provider credentials')
      expect(card.text()).toContain('Last healthy:')
      expect(card.get('[data-testid="health-failure-reference"]').text()).toContain(lastCheck)
      expect(card.text()).toContain(failure.code)
      expect(card.text()).not.toContain('Not Configured')
    }
    expect(wrapper.get('[data-testid="service-card-rag"]').text()).not.toContain('Embeddings: 0')
    expect(wrapper.get('[data-testid="service-card-imageEmbeddings"]').text()).not.toContain('Mode: disabled')
    expect(api.refreshSystemHealth).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('explains changed configuration without automatically retrying', async () => {
    const failure = { stage: 'configuration_validation', code: 'configuration_changed' }
    const observation = { status: 'unknown', lastCheck: fresh.checkedAt, failure, freshness: fresh,
      error: 'Settings changed while this health check was running. Refresh health to check the current settings, or wait for the next heartbeat.' }
    const wrapper = await mountSystem({}, { ...baseHealth, radarr: 'unknown',
      details: { ...baseHealth.details, radarr: observation } })
    const card = wrapper.get('[data-testid="service-card-radarr"]')
    expect(card.text()).toContain('Unknown')
    expect(card.text()).toContain('Refresh health to check the current settings')
    expect(card.get('[data-testid="health-failure-reference"]').text()).toContain(failure.code)
    expect(api.refreshSystemHealth).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders failure references as text and clears them after normal polling recovery', async () => {
    const failure = { code: '<script>private()</script>', stage: '<img src=x onerror=private()>' }
    const wrapper = await mountSystem({}, { ...baseHealth, radarr: 'unknown',
      details: { ...baseHealth.details, radarr: { failure, freshness: fresh, error: 'Safe failure', lastCheck: fresh.checkedAt } } })
    const card = wrapper.get('[data-testid="service-card-radarr"]')
    expect(card.get('[data-testid="health-failure-reference"]').text()).toContain(failure.code)
    expect(card.find('script').exists()).toBe(false)
    expect(card.find('img').exists()).toBe(false)
    api.getSystemHealth.mockResolvedValue(baseHealth)
    await vi.advanceTimersByTimeAsync(30000)
    await flushPromises()
    expect(card.find('[data-testid="health-failure-reference"]').exists()).toBe(false)
    expect(api.refreshSystemHealth).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each(['current_process', 'other_process'])('renders scoped %s startup evidence without claiming binary attestation', async status => {
    const wrapper = await mountSystem({ pgvector: {
      build: 'multi', selectedVariant: 'generic', cpuAvx: 'true', cpuAvx2: 'true',
      selection: { status, report: {
        reason: 'staging_disabled', databaseScope: 'embedded_entrypoint',
        reporterId: '12345678-1234-4567-8123-123456789abc',
        selectedAt: '2026-10-12T14:58:00.000Z', recordedAt: '2026-10-12T15:00:00.000Z',
        databaseStartedAt: '2026-10-12T14:59:00.000Z',
      } },
    } })
    const report = wrapper.get('[data-testid="pgvector-startup-report"]')
    expect(report.text()).toContain('12345678-1234-4567-8123-123456789abc')
    expect(report.text()).toContain('2026-10-12T14:59:00.000Z')
    if (status === 'current_process') expect(report.text()).toContain('staging was disabled')
    else {
      expect(report.text()).toContain('another application process')
      expect(report.text()).not.toContain('staging was disabled')
    }
    wrapper.unmount()
  })

  it('reports a CPU mismatch without inventing an unhealthy database', async () => {
    const wrapper = await mountSystem({
      pgvector: {
        selection: { ...currentPgvector.selection,
          report: { ...currentPgvector.selection.report, cpuAvx2: 'false' },
        },
      }
    })
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toBe('CPU mismatch reported at startup')
    expect(wrapper.get('[data-testid="service-card-database"]').text()).toContain('Healthy')
    expect(wrapper.find('[data-testid="service-card-pgvector"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(['disabled', 'unavailable', 'unknown'])('retains RAG %s independently of CPU compatibility', async rag => {
    const wrapper = await mountSystem({ pgvector: currentPgvector }, {
      ...baseHealth, database: 'disconnected', rag,
      details: { ...baseHealth.details, rag: { pgvector: false, embeddingsTable: false, freshness: fresh } },
    })
    expect(wrapper.get('[data-testid="service-card-database"]').text()).toContain('Unhealthy')
    expect(wrapper.get('[data-testid="service-card-rag"]').text()).toContain(
      { disabled: 'Disabled', unavailable: 'Unhealthy', unknown: 'Unknown' }[rag],
    )
    expect(wrapper.get('[data-testid="service-card-rag"]').text()).toContain('pgvector unavailable')
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toContain('CPU match')
    wrapper.unmount()
  })

  it.each(['health', 'status'])('never inserts a synthetic service when %s resolves last', async delayed => {
    let resolve
    const pending = new Promise(done => { resolve = done })
    const mock = delayed === 'health' ? api.getSystemHealth : api.getSystemStatus
    mock.mockReturnValueOnce(pending)
    const wrapper = await mountSystem({ pgvector: currentPgvector })
    expect(wrapper.find('[data-testid="service-card-pgvector"]').exists()).toBe(false)
    resolve(delayed === 'health' ? baseHealth : { ...baseStatus, pgvector: currentPgvector })
    await flushPromises()
    expect(wrapper.find('[data-testid="service-card-pgvector"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="service-card-"]')).toHaveLength(12)
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toContain('CPU match')
    await vi.advanceTimersByTimeAsync(30000)
    expect(wrapper.findAll('[data-testid^="service-card-"]')).toHaveLength(12)
    wrapper.unmount()
  })

  it('keeps a health request failure visible even when startup reports a CPU match', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.getSystemHealth.mockRejectedValueOnce(new Error('Fixture health request failed'))
    const wrapper = await mountSystem({ pgvector: currentPgvector })
    expect(wrapper.text()).toContain('Unable to read health status')
    expect(wrapper.text()).not.toContain('Fixture health request failed')
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toContain('CPU match')
    expect(wrapper.find('[data-testid="service-card-pgvector"]').exists()).toBe(false)
    wrapper.unmount()
    errorLog.mockRestore()
  })

  it('does not infer compatibility from legacy settings or an extension version alone', async () => {
    const wrapper = await mountSystem({ pgvectorVersion: '0.8.1', pgvector: null })
    expect(wrapper.get('[data-testid="pgvector-compatibility-label"]').text()).toBe('Compatibility unknown')
    expect(wrapper.text()).toContain('0.8.1')
    wrapper.unmount()
  })

  it.each([{}, { ...baseHealth, rag: 'healthy', imageEmbeddings: 'unknown' }])('does not report unknown observations as operational', async health => {
    const wrapper = await mountSystem({}, health)
    expect(wrapper.get('[data-testid="system-health-summary"]').text()).toContain('Health status incomplete')
    wrapper.unmount()
  })

  it('excludes inactive services and never reports an inactive-only list as healthy', async () => {
    const health = Object.fromEntries(Object.keys(baseHealth).filter(key => key !== 'details').map(key => [key, 'disabled']))
    const wrapper = await mountSystem({}, { ...health, imageEmbeddings: 'not configured' })
    const summary = wrapper.get('[data-testid="system-health-summary"]')
    expect(summary.text()).toContain('No active services to assess')
    expect(summary.text()).toContain('0 of 0 active services')
    expect(summary.text()).toContain('11 disabled; 1 not configured')
    wrapper.unmount()
  })

  it('marks a legacy response without freshness unknown rather than claiming current health', async () => {
    const wrapper = await mountSystem({}, { ...baseHealth, rag: 'healthy', details: {}, freshnessPolicy: undefined })
    expect(wrapper.get('[data-testid="system-health-summary"]').text()).toContain('Health status incomplete')
    const card = wrapper.get('[data-testid="service-card-database"]')
    expect(card.text()).toContain('Check time unavailable')
    expect(card.text()).toContain('Last reported status: Healthy. This is not a current result.')
    expect(wrapper.get('[data-testid="service-card-radarr"]').text()).not.toContain('Check time unavailable')
    wrapper.unmount()
  })

  it('shows paused cadence and overdue historical failures, then accepts a fresh poll without extra probes', async () => {
    const stale = { ...fresh, state: 'stale', reason: 'check_overdue', ageMs: 930000 }
    const wrapper = await mountSystem({}, { ...baseHealth, database: 'disconnected',
      freshnessPolicy: { ...baseHealth.freshnessPolicy, heartbeatActive: false },
      details: { ...baseHealth.details, database: { freshness: stale } },
    })
    const card = wrapper.get('[data-testid="service-card-database"]')
    expect(card.text()).toContain('Unknown')
    expect(card.text()).toContain('Check overdue')
    expect(card.text()).toContain('Last reported status: Unhealthy')
    expect(card.text()).toContain(fresh.checkedAt)
    expect(card.text()).toContain(fresh.expiresAt)
    const summary = wrapper.get('[data-testid="system-health-summary"]')
    expect(summary.text()).toContain('Automatic health checks are paused')
    expect(summary.text()).toContain('Check cadence: 15 minutes')
    expect(summary.get('[role="status"]').text()).not.toContain(fresh.checkedAt)
    api.getSystemHealth.mockResolvedValue(baseHealth)
    await vi.advanceTimersByTimeAsync(30000)
    expect(card.text()).not.toContain('Check overdue')
    expect(summary.text()).not.toContain('Automatic health checks are paused')
    expect(api.refreshSystemHealth).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not show a stale instance as current when its group is fresh', async () => {
    const wrapper = await mountSystem({}, { ...baseHealth, radarr: 'connected', details: {
      ...baseHealth.details, radarr: { freshness: { ...fresh, state: 'unknown', reason: 'instance_checks_incomplete' }, instances: [{ id: 7, name: 'Fixture instance', status: 'connected',
        freshness: { ...fresh, state: 'stale', reason: 'check_overdue', ageMs: 930000 } }] },
    } })
    const card = wrapper.get('[data-testid="service-card-radarr"]')
    expect(card.text()).toContain('Some instance checks are overdue or unverified')
    await card.get('button').trigger('click')
    expect(card.text()).toContain('Fixture instance')
    expect(card.text()).toContain('Unknown')
    expect(card.text()).toContain('Check overdue')
    wrapper.unmount()
  })

  it('marks retained results unavailable after a poll fails and clears that state only on success', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountSystem()
    api.getSystemHealth.mockRejectedValueOnce(new Error('Private failure detail'))
    await vi.advanceTimersByTimeAsync(30000)
    const summary = wrapper.get('[data-testid="system-health-summary"]')
    expect(summary.text()).toContain('Health summary unavailable')
    expect(summary.text()).toContain('Showing last received results')
    expect(wrapper.findAll('[data-testid^="service-card-"]')).toHaveLength(12)
    expect(wrapper.text()).not.toContain('Private failure detail')
    await vi.advanceTimersByTimeAsync(30000)
    expect(summary.text()).not.toContain('Health summary unavailable')
    wrapper.unmount()
    errorLog.mockRestore()
  })

  it('does not silently fall back to cached health after a forced refresh fails', async () => {
    const wrapper = await mountSystem()
    api.refreshSystemHealth.mockRejectedValueOnce(new Error('Private failure'))
    await wrapper.findAll('button').find(button => button.text().includes('Refresh')).trigger('click')
    await flushPromises()
    expect(api.getSystemHealth).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Fresh health checks could not be completed')
    expect(wrapper.get('[data-testid="system-health-summary"]').text()).toContain('Health summary unavailable')
    wrapper.unmount()
  })

  it.each([null, [], 'invalid'])('rejects malformed response %j without claiming healthy', async health => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountSystem({}, health)
    expect(wrapper.get('[data-testid="system-health-summary"]').text()).toContain('No successful health response received yet')
    expect(wrapper.text()).toContain('Unable to read health status')
    wrapper.unmount()
    errorLog.mockRestore()
  })

  it('waits for forced refresh before reading results and suppresses periodic reads meanwhile', async () => {
    let resolve
    const wrapper = await mountSystem()
    api.refreshSystemHealth.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await wrapper.findAll('button').find(button => button.text().includes('Refresh')).trigger('click')
    await vi.advanceTimersByTimeAsync(30000)
    expect(api.getSystemHealth).toHaveBeenCalledTimes(1)
    resolve({ success: true })
    await flushPromises()
    expect(api.getSystemHealth).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).not.toContain('Unable to read health status')
    wrapper.unmount()
  })

  it.each(['resolve', 'reject'])('ignores an older request that finishes via %s after the latest poll', async finish => {
    let resolve, reject
    api.getSystemHealth.mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail }))
    const wrapper = await mountSystem()
    await vi.advanceTimersByTimeAsync(30000)
    const before = wrapper.get('[data-testid="system-health-summary"]').text()
    if (finish === 'resolve') resolve({ ...baseHealth, database: 'disconnected' })
    else reject(new Error('Obsolete failure'))
    await flushPromises()
    expect(wrapper.get('[data-testid="system-health-summary"]').text()).toBe(before)
    wrapper.unmount()
  })

  it('does not accept a response or keep polling after unmount', async () => {
    let resolve
    api.getSystemHealth.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const wrapper = await mountSystem()
    wrapper.unmount()
    resolve(baseHealth)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(60000)
    expect(api.getSystemHealth).toHaveBeenCalledTimes(1)
  })
})
