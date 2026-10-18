/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import * as files from '../ollamaGateway/archiveManagedFiles.mjs';
import * as markers from '../ollamaGateway/archiveProtectionFiles.mjs';
const check=jest.fn(), marker=jest.fn();
jest.unstable_mockModule('../ollamaGateway/archiveManagedFiles.mjs',() => ({ ...files,checkManagedArchive:check }));
jest.unstable_mockModule('../ollamaGateway/archiveProtectionFiles.mjs',() => ({ ...markers,ensureArchiveProtection:marker }));
const { reconcileArchiveProtection }=await import('../ollamaGateway/archiveProtectionService.mjs');
const id=n => `019a0000-0000-7000-8000-${String(n).padStart(12,'0')}`;
const jobs=() => [1,2,3,4].map(n => ({ id:id(n),status:'verified',recovery_protection_id:id(n%2+10),protection:{ ready_at:null } }));
let repository;
beforeEach(() => {
  check.mockReset(); marker.mockReset();
  repository={ evidence:jest.fn(async summary => ({ ...summary,manifest:{ retained:'body' } })),ready:jest.fn() };
});

test('interleaved protected pairs are read one at a time before readiness',async () => {
  let active=0,peak=0;
  repository.evidence.mockImplementation(async summary => {
    peak=Math.max(peak,++active); await Promise.resolve(); active--;
    return { ...summary,manifest:{ retained:'body' } };
  });
  await reconcileArchiveProtection(repository,'/fixture',jobs());
  expect(peak).toBe(1); expect(check).toHaveBeenCalledTimes(4); expect(marker).toHaveBeenCalledTimes(4);
  expect(repository.ready).toHaveBeenCalledTimes(2);
  expect(repository.ready.mock.invocationCallOrder[0]).toBeGreaterThan(marker.mock.invocationCallOrder.at(-1));
});

test('a late corrupt member prevents every readiness write',async () => {
  check.mockImplementation(async (_parent,job) => { if (job.id===id(4)) throw new Error('synthetic_corruption'); });
  await expect(reconcileArchiveProtection(repository,'/fixture',jobs())).rejects.toThrow('synthetic_corruption');
  expect(repository.ready).not.toHaveBeenCalled();
});

test('an incomplete later group cannot publish an earlier complete group',async () => {
  await expect(reconcileArchiveProtection(repository,'/fixture',jobs().slice(0,3))).rejects.toThrow('gateway_archive_protection_fence');
  expect(repository.ready).not.toHaveBeenCalled();
});

test('cancellation carries no partial credit into a fresh assessment',async () => {
  const controller=new AbortController();
  check.mockImplementation(async (_parent,job) => { if (job.id===id(2)) controller.abort(); });
  await expect(reconcileArchiveProtection(repository,'/fixture',jobs(),controller.signal)).rejects.toMatchObject({ name:'AbortError' });
  expect(repository.ready).not.toHaveBeenCalled();
  repository.evidence.mockClear(); check.mockReset();
  await reconcileArchiveProtection(repository,'/fixture',jobs());
  expect(repository.evidence.mock.calls.map(call => call[0].id)).toEqual(jobs().map(job => job.id));
});
