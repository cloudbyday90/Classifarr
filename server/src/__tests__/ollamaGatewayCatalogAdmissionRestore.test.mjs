/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import * as contentModule from '../ollamaGateway/catalogContent.mjs';
import * as relationshipsModule from '../ollamaGateway/catalogRelationships.mjs';
import * as admissionModule from '../ollamaGateway/catalogAdmission.mjs';
import { catalogSemanticRevision } from '../ollamaGateway/catalogSchedule.mjs';
import { catalogAdmissionRecord } from '../ollamaGateway/catalogAdmissionContract.mjs';
import { frozenCatalogSample, canonicalAdmission } from './fixtures/gatewayCatalogAdmission.mjs';

const content = jest.fn(), relationships = jest.fn(), history = jest.fn();
jest.unstable_mockModule('../ollamaGateway/catalogContent.mjs', () => ({ ...contentModule, captureCatalogContent: content }));
jest.unstable_mockModule('../ollamaGateway/catalogRelationships.mjs', () => ({ ...relationshipsModule, checkCatalogRelationships: relationships }));
jest.unstable_mockModule('../ollamaGateway/catalogAdmission.mjs', () => ({ ...admissionModule, checkCatalogAdmissionHistory: history }));
const { restoreCatalogAdmission, assertRestoredCatalogAdmission } = await import('../ollamaGateway/catalogAdmissionRestore.mjs');
let manifest, owner, restricted, budget, events;
beforeEach(() => {
  ({ manifest } = frozenCatalogSample()); const row = JSON.parse(manifest.catalog.admission.row);
  manifest.catalog.semanticSha256 = row.semantic_sha256 = catalogSemanticRevision(manifest.catalog.tables);
  manifest.catalog.admission = catalogAdmissionRecord(canonicalAdmission(row));
  content.mockReset().mockResolvedValue(manifest.catalog.tables); relationships.mockReset().mockResolvedValue(undefined);
  history.mockReset().mockResolvedValue(undefined); budget = { bytes: 0 }; events = [];
  owner = { query: jest.fn(async sql => { events.push(sql); return { rows: [{ row: manifest.catalog.admission.row }] }; }) };
  restricted = { connect: jest.fn(async () => { events.push('connect'); }), end: jest.fn(async () => {}),
    query: jest.fn(async sql => { events.push(sql); return { rows: [{ row: manifest.catalog.admission.row }] }; }) };
});
const restore = signal => restoreCatalogAdmission(owner, restricted, manifest, budget, signal);
test('verifies frozen rows/history before restricted insertion and exact canonical round trip', async () => {
  await restore(); await assertRestoredCatalogAdmission(owner, manifest);
  expect(events.indexOf('COMMIT')).toBeLessThan(events.indexOf('connect'));
  expect(relationships).toHaveBeenCalledWith(owner, manifest.archiveId, manifest.report, 3);
  expect(history).toHaveBeenCalledWith(owner, manifest);
  const insertion = restricted.query.mock.calls.find(([sql]) => sql.startsWith('INSERT'));
  expect(insertion[1]).toEqual([manifest.catalog.admission.row]);
  expect(budget.bytes).toBe(Buffer.byteLength(manifest.catalog.admission.row));
  expect(restricted.end).toHaveBeenCalledTimes(1);
});
test('a mismatched frozen table proof never connects the inserting login', async () => {
  content.mockResolvedValue({ ...manifest.catalog.tables, extra: {} });
  await expect(restore()).rejects.toThrow('gateway_archive_restore_mismatch');
  expect(owner.query).toHaveBeenCalledWith('ROLLBACK'); expect(restricted.connect).not.toHaveBeenCalled();
});
test.each(['relationships', 'history'])('invalid %s prevents any supplemental insertion', async kind => {
  (kind === 'history' ? history : relationships).mockRejectedValue(new Error('synthetic_refusal'));
  await expect(restore()).rejects.toThrow('synthetic_refusal'); expect(restricted.connect).not.toHaveBeenCalled();
});
test('canonical round-trip mismatch rolls back instead of replacing or repairing a record', async () => {
  restricted.query.mockResolvedValue({ rows: [{ row: '{}' }] });
  await expect(restore()).rejects.toThrow('gateway_archive_restore_mismatch');
  expect(restricted.query).toHaveBeenCalledWith('ROLLBACK'); expect(restricted.end).toHaveBeenCalledTimes(1);
});
test('cancellation after INSERT preserves failure and closes the private login without COMMIT', async () => {
  const controller = new AbortController();
  restricted.query.mockImplementation(async sql => {
    if (sql.startsWith('INSERT')) controller.abort(); return { rows: [{ row: manifest.catalog.admission.row }] };
  });
  await expect(restore(controller.signal)).rejects.toThrow();
  expect(restricted.query).not.toHaveBeenCalledWith('COMMIT'); expect(restricted.query).toHaveBeenCalledWith('ROLLBACK');
  expect(restricted.end).toHaveBeenCalledTimes(1);
});
test('post-seal missing or changed admission cannot produce a verification receipt', async () => {
  for (const rows of [[], [{ row: '{}' }]]) {
    owner.query.mockResolvedValue({ rows }); await expect(assertRestoredCatalogAdmission(owner, manifest)).rejects.toThrow('gateway_archive_restore_mismatch');
  }
});
