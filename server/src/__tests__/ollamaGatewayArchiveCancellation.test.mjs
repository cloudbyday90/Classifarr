/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import * as online from '../ollamaGateway/onlineArchive.mjs';
import * as files from '../ollamaGateway/archiveManagedFiles.mjs';
import * as protection from '../ollamaGateway/archiveProtectionService.mjs';
import * as schedule from '../ollamaGateway/archiveSchedule.mjs';
import * as catalogSchedule from '../ollamaGateway/catalogSchedule.mjs';
import * as jobs from '../ollamaGateway/catalogJobRepository.mjs';
import * as roots from '../ollamaGateway/catalogRetentionRepository.mjs';
import * as content from '../ollamaGateway/catalogContent.mjs';
import * as capture from '../ollamaGateway/catalogCapture.mjs';
import * as admission from '../ollamaGateway/catalogAdmission.mjs';
import * as owned from '../ollamaGateway/ownedCatalogSnapshot.mjs';

let controller, repository, events, catalog, captureError;
const report = { ledgerId: 'ledger', providerHash: 'provider', bindingCount: 1, capturedAt: new Date().toISOString() };
const job = { id: 'job', revision: 'revision' };
jest.unstable_mockModule('../ollamaGateway/ownedCatalogSnapshot.mjs', () => ({ ...owned,
  withOwnedCatalogSnapshot: async (_configuration,consume,signal) => {
    try {
      const result = await consume({report,revision:'revision',compatibleRevisions:['revision'],semantic:'semantic',signal,
        capture:async () => {if(captureError)throw captureError;controller.abort();signal.throwIfAborted();}});
      if (signal.aborted) throw Object.assign(new Error('gateway_archive_cancelled'),{code:'gateway_archive_cancelled'});
      if (captureError) throw captureError;
      events.push('commit'); return result;
    } catch (error) {events.push('rollback');throw error;}
  },
}));
jest.unstable_mockModule('../ollamaGateway/onlineArchive.mjs', () => ({ ...online,
  withOnlineArchiveSnapshot: async (_source, _configuration, consume, signal) => {
    try {
      const result = await consume({ report, revision: 'revision', compatibleRevisions: ['revision'] });
      signal.throwIfAborted(); events.push('commit'); return result;
    } catch (error) { events.push('rollback'); throw error; }
  },
  createOnlineArchive: async () => { controller.abort(); controller.signal.throwIfAborted(); }
}));
jest.unstable_mockModule('../ollamaGateway/archiveManagedFiles.mjs', () => ({ ...files, archiveStorageAvailable: async () => true }));
jest.unstable_mockModule('../ollamaGateway/archiveProtectionService.mjs', () => ({ ...protection,
  reconcileArchiveProtection: async () => {}, planArchiveProtection: async () => ({ needsRecoveryCopy: false }) }));
jest.unstable_mockModule('../ollamaGateway/archiveSchedule.mjs', () => ({ ...schedule, archiveDue: () => catalog ? 'unchanged' : 'due' }));
jest.unstable_mockModule('../ollamaGateway/catalogSchedule.mjs', () => ({ ...catalogSchedule, catalogDue: () => 'due', catalogSemanticRevision: () => 'semantic' }));
jest.unstable_mockModule('../ollamaGateway/catalogJobRepository.mjs', () => ({ ...jobs, catalogJobRepository: () => repository }));
jest.unstable_mockModule('../ollamaGateway/catalogRetentionRepository.mjs', () => ({ ...roots, catalogRetentionRepository: () => ({ list: async () => [] }) }));
jest.unstable_mockModule('../ollamaGateway/catalogContent.mjs', () => ({ ...content, captureCatalogContent: async () => ({}) }));
jest.unstable_mockModule('../ollamaGateway/catalogCapture.mjs', () => ({ ...capture,
  captureScheduledCatalog: async () => { controller.abort(); controller.signal.throwIfAborted(); } }));
jest.unstable_mockModule('../ollamaGateway/catalogAdmission.mjs', () => ({ ...admission, requireCatalogCaptureFormat: async () => {} }));
const { runArchiveAssessment } = await import('../ollamaGateway/archiveCoordinator.mjs');
const { runCatalogAssessment } = await import('../ollamaGateway/catalogCoordinator.mjs');

beforeEach(() => {
  controller = new AbortController(); events = []; catalog = false; captureError = null;
  repository = { list: async () => [], hasCatalogRetention: async () => false, cleanupOperations: async () => [],
    begin: jest.fn(async () => job), published: jest.fn(), failed: jest.fn(async () => { events.push('recorded'); }),
    catalogRetention: { rotate: async () => {} } };
});
const source = { query: async () => ({ rows: [{ id: report.ledgerId, provider_hash: report.providerHash }] }) };
const run = () => {
  const input = { source, maintenance: { query: async () => ({ rows: [] }) }, repository,
    configuration: { providerHash: report.providerHash, retentionDays: 90 }, paths: {}, signal: controller.signal };
  return catalog ? runCatalogAssessment(input) : runArchiveAssessment(input);
};

test.each([false, true])('durable cancellation survives read-only snapshot rollback (catalog=%s)', async value => {
  catalog = value;
  expect(await run()).toEqual({ state: value ? 'catalog_cancelled' : 'cancelled', archiveId: job.id, purgeAuthorized: false });
  expect(repository.failed).toHaveBeenCalledWith(job.id, 'cancelled');
  expect(events.slice(-2)).toEqual(['recorded', 'rollback']);
  expect(repository.begin).toHaveBeenCalledTimes(1); expect(repository.published).not.toHaveBeenCalled();
});

test.each([false, true])('failed cancellation persistence stays uncertain, not acknowledged (catalog=%s)', async value => {
  catalog = value; repository.failed.mockRejectedValue(new Error('persistence_unknown'));
  await expect(run()).rejects.toThrow('persistence_unknown');
  expect(events.at(-1)).toBe('rollback'); expect(repository.published).not.toHaveBeenCalled();
});

test('settled capture failure returns its outcome only after durable recording',async()=>{
  catalog=true; captureError=new Error('capture_failed');
  expect(await run()).toEqual({state:'catalog_export_failed',archiveId:job.id,purgeAuthorized:false});
  expect(repository.failed).toHaveBeenCalledWith(job.id,'export_failed');
  expect(events.slice(-2)).toEqual(['recorded','rollback']); expect(repository.published).not.toHaveBeenCalled();
});

test('settled capture failure cannot hide failed persistence',async()=>{
  catalog=true; captureError=new Error('capture_failed'); repository.failed.mockRejectedValue(new Error('persistence_unknown'));
  await expect(run()).rejects.toThrow('persistence_unknown'); expect(repository.published).not.toHaveBeenCalled();
});
