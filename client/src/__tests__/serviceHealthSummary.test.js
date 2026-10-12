/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, it, expect } from 'vitest'
import { getOverallHealth, normalizeServiceHealthStatus } from '../utils/serviceHealthSummary'
import { summarizeServiceHealth, normalizeServiceHealthStatus as normalizeServerStatus } from '../../../server/src/services/serviceHealthSummary.mjs'

const rows = values => values.map(status => ({ status }))
describe('service health summary', () => {
  it.each([
    [[], 'unknown', 0], [['unknown'], 'unknown', 1],
    [['disabled', 'not configured'], 'unknown', 0],
    [['healthy', 'unknown'], 'unknown', 2],
    [['healthy', 'disabled', 'not_configured'], 'healthy', 1],
    [['healthy', 'configured'], 'degraded', 2],
    [['degraded', 'unknown'], 'degraded', 2],
    [['unhealthy', 'degraded', 'unknown'], 'unhealthy', 3],
  ])('summarizes %j as %s', (values, status, active) => {
    expect(getOverallHealth(rows(values))).toMatchObject({ status, active })
  })
  it.each([null, undefined, {}, 'healthy'])('never invents health for malformed collection %j', value => {
    expect(getOverallHealth(value)).toMatchObject({ status: 'unknown', total: 0 })
  })
  it('counts malformed rows as unknown and excludes only explicit inactive rows', () => {
    expect(getOverallHealth([null, {}, { status: false }, { status: 'future' }])).toMatchObject({ status: 'unknown', unknown: 4, active: 4 })
  })
  it('invalidates even a healthy saved observation after request failure', () => {
    expect(getOverallHealth(rows(['healthy']), { observationAvailable: false })).toMatchObject({
      status: 'unknown', healthy: 1, message: 'Health summary unavailable',
    })
  })
  it('keeps the separately deployed client and server policies aligned', () => {
    const values = ['healthy', 'connected', 'available', 'configured', 'circuit_open', 'degraded', 'partial', 'unhealthy', 'error', 'disconnected', 'unavailable', 'disabled', 'not_configured', 'not configured', 'unknown', 'future', null, 42, 'HEALTHY']
    for (const a of values) {
      expect(normalizeServiceHealthStatus(a)).toBe(normalizeServerStatus(a))
      for (const b of values) {
        const services = rows([a, b])
        const client = getOverallHealth(services)
        const server = summarizeServiceHealth(services)
        expect(client.status).toBe(server.overall)
        for (const field of ['total', 'active', 'healthy', 'degraded', 'unknown', 'disabled', 'notConfigured']) {
          expect(client[field]).toBe(server.summary[field])
        }
        expect(client.unhealthy).toBe(server.summary.failed)
        expect(server.summary.unhealthy).toBe(client.unhealthy + client.degraded)
      }
    }
  })
})
