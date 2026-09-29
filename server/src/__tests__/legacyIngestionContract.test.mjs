/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { projectLegacyIngestion, reconciliationRequest } from '../services/legacyIngestionContract.mjs';
const snapshot = () => ({ library: { id: 1, name: 'Synthetic', media_type: 'movie', media_server_id: 2, is_active: false },
  ownership: null, syncs: [{ id: 3, status: 'running', items_processed: 4 }], capture: null, activeOwner: false });

test('preview is deterministic, actor-bound, bounded and does not expose raw revisions', () => {
  const input = snapshot(), preview = projectLegacyIngestion(input, 7);
  expect(preview).toMatchObject({ canReconcile: true, reason: 'confirmation_required', syncs: [{ id: 3, processed: 4 }] });
  expect(projectLegacyIngestion(input, 7)).toEqual(preview);
  expect(projectLegacyIngestion(input, 8).revision).not.toBe(preview.revision);
  input.syncs[0].items_processed++;
  expect(projectLegacyIngestion(input, 7).revision).not.toBe(preview.revision);
  input.syncs = Array.from({ length: 101 }, (_, id) => ({ id, status: 'running' }));
  expect(projectLegacyIngestion(input, 7)).toMatchObject({ canReconcile: false, reason: 'too_many_markers', truncated: true });
  expect(projectLegacyIngestion(input, 7).syncs).toHaveLength(100);
});

test('current owners, enabled libraries, owned recovery and unsupported types are not eligible', () => {
  const input = snapshot();
  input.activeOwner = true;
  expect(projectLegacyIngestion(input, 1).reason).toBe('active_owner');
  input.activeOwner = false; input.library.is_active = true;
  expect(projectLegacyIngestion(input, 1).reason).toBe('disable_library');
  input.ownership = { sync_status_id: 3 };
  expect(projectLegacyIngestion(input, 1)).toMatchObject({ reason: 'not_needed', canResume: false });
  input.library.media_type = 'music';
  expect(projectLegacyIngestion(input, 1).reason).toBe('unsupported_library');
});

test('confirmation requires exact strong revision, literal attestation, bounded IDs and UUID', () => {
  const body = { requestId: randomUUID(), workersStopped: true }, revision = projectLegacyIngestion(snapshot(), 7).revision;
  expect(reconciliationRequest(7, '1', body, revision)).toMatchObject({ actorId: 7, libraryId: 1, revision });
  for (const invalid of [null, { ...body, extra: true }, { ...body, workersStopped: 'true' }, { ...body, requestId: 'bad' }]) {
    expect(() => reconciliationRequest(7, 1, invalid, revision)).toThrow();
  }
  for (const invalid of [undefined, '*', `W/${revision}`, `${revision},${revision}`, 'x'.repeat(1000)]) {
    expect(() => reconciliationRequest(7, 1, body, invalid)).toThrow();
  }
  expect(() => reconciliationRequest(7, '1 OR 1=1', body, revision)).toThrow();
});

test('resume is explicit and checks configured, enabled supported sources without exposing their settings', () => {
  const input = snapshot();
  input.library.is_active = true;
  input.source = { revision: 'private-revision', type: 'plex', is_active: true, configured: true };
  for (const type of ['plex', 'jellyfin', 'emby']) {
    input.source.type = type;
    expect(projectLegacyIngestion(input, 7)).toMatchObject({ canReconcile: false, canResume: true, resumeReason: 'confirmation_required' });
  }
  expect(JSON.stringify(projectLegacyIngestion(input, 7))).not.toContain('private-revision');
  for (const [field, value, reason] of [['type', 'unknown', 'unsupported_source'], ['is_active', false, 'source_disabled'], ['configured', false, 'source_unconfigured']]) {
    const modified = structuredClone(input); modified.source[field] = value;
    expect(projectLegacyIngestion(modified, 7)).toMatchObject({ canResume: false, resumeReason: reason });
  }
  input.activeOwner = true;
  expect(projectLegacyIngestion(input, 7)).toMatchObject({ canResume: false, resumeReason: 'active_owner' });
  input.activeOwner = false; input.library.is_active = false;
  expect(projectLegacyIngestion(input, 7)).toMatchObject({ canResume: false, canReconcile: true, resumeReason: 'library_disabled' });
  input.library.archived_at = '2026-09-01';
  expect(projectLegacyIngestion(input, 7)).toMatchObject({ canResume: false, resumeReason: 'library_archived' });
});

test('resume request rejects implicit/coerced authority and preserves the legacy default', () => {
  const body = { requestId: randomUUID(), workersStopped: true }, revision = projectLegacyIngestion(snapshot(), 7).revision;
  expect(reconciliationRequest(7, 1, body, revision).resume).toBe(false);
  expect(reconciliationRequest(7, 1, { ...body, resume: true }, revision).resume).toBe(true);
  expect(reconciliationRequest(7, 1, { ...body, resume: false }, revision).resume).toBe(false);
  for (const resume of ['true', 1, null, undefined, {}, []]) expect(() => reconciliationRequest(7, 1, { ...body, resume }, revision)).toThrow();
  expect(reconciliationRequest(7, 1, Object.assign(Object.create({ resume: true }), body), revision).resume).toBe(false);
  expect(() => reconciliationRequest(7, 1, { ...body, resume: true, workersStopped: false }, revision)).toThrow();
});
