/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, test, expect } from '@jest/globals';
import { summarizeServiceHealth, normalizeServiceHealthStatus } from '../services/serviceHealthSummary.mjs';

describe('service health summary', () => {
  test.each([null, undefined, {}, [], 'healthy'])( 'empty/malformed collection stays unknown: %j', services => {
    expect(summarizeServiceHealth(services)).toMatchObject({ overall: 'unknown', summary: { total: 0, active: 0 } });
  });
  test.each([
    [['healthy'], 'healthy'], [['disabled', 'not configured'], 'unknown'],
    [['healthy', 'unknown'], 'unknown'], [['healthy', 'configured'], 'degraded'],
    [['unhealthy', 'unknown', 'degraded'], 'unhealthy'],
  ])('%j yields %s', (statuses, overall) => {
    expect(summarizeServiceHealth(statuses.map(status => ({ status }))).overall).toBe(overall);
  });
  test('keeps unhealthy as failed plus degraded without counting unknown/inactive rows', () => {
    expect(summarizeServiceHealth(['connected', 'error', 'partial', null, 'disabled', 'not_configured'].map(status => ({ status })))).toEqual({
      overall: 'unhealthy', summary: { total: 6, active: 4, healthy: 1, failed: 1, degraded: 1, unknown: 1, disabled: 1, notConfigured: 1, unhealthy: 2 },
    });
  });
  test('handles malformed rows and unknown states conservatively', () => {
    expect(summarizeServiceHealth([null, {}, { status: 'future' }])).toMatchObject({ overall: 'unknown', summary: { unknown: 3 } });
    expect(normalizeServiceHealthStatus('HEALTHY')).toBe('healthy');
    expect(normalizeServiceHealthStatus(42)).toBe('unknown');
  });
});
