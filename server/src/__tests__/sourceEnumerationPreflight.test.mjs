/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { preflightSourceEnumeration } from '../services/sourceEnumerationPreflight.mjs';
import { SourceEnumerationError } from '../services/sourceEnumerationError.mjs';
import { SourcePreflightError, readSourcePreflightDiagnostic, sourcePreflightFailureReason } from '../services/sourcePreflightDiagnostic.mjs';
import { sourcePageFixture } from './helpers/sourcePageFixture.mjs';

function fixture() {
  const owner = { signal: new AbortController().signal, assertSource: jest.fn() };
  const getLibraryPage = jest.fn(async (_u, _k, _l, { offset }) => sourcePageFixture([{ external_id: String(offset + 1) }], { offset, total: 100 }));
  const getCollectionPage = jest.fn(async () => sourcePageFixture([]));
  const args = { service: { getLibraryPage, getCollectionPage }, url: 'http://synthetic.invalid',
    apiKey: 'private-token', libraryKey: 'library', owner, batchSize: 100 };
  return { args, owner, getLibraryPage, getCollectionPage };
}

test('canary requests at most two pages per endpoint and keeps partial samples separate from completeness', async () => {
  const { args, getLibraryPage, getCollectionPage, owner } = fixture();
  const pages = await preflightSourceEnumeration(args);
  expect(pages.media).toHaveLength(2);
  expect(pages.collections).toHaveLength(1);
  expect(pages).not.toHaveProperty('receipt');
  expect(getLibraryPage.mock.calls.map(call => call[3])).toEqual([0, 1].map(offset => ({ offset, limit: 2, signal: owner.signal, preflight: true })));
  expect(getCollectionPage).toHaveBeenCalledTimes(1);
  expect(owner.assertSource).toHaveBeenCalledTimes(6);
});
test.each([0, 1])('explicit total %i avoids requesting a nonexistent next page', async total => {
  const { args, getLibraryPage } = fixture();
  getLibraryPage.mockResolvedValue(sourcePageFixture(total ? [{ external_id: '1' }] : []));
  await preflightSourceEnumeration({ ...args, batchSize: 1 });
  expect(getLibraryPage).toHaveBeenCalledTimes(1);
  expect(getLibraryPage.mock.calls[0][3].limit).toBe(1);
});
test.each([
  ['unknown_source_total', sourcePageFixture([{ external_id: '1' }], { total: null })],
  ['unexpected_page_offset', sourcePageFixture([{ external_id: '1' }], { offset: 5 })],
  ['invalid_response', null],
])('rejects %s before checking collections', async (reason, page) => {
  const { args, getLibraryPage, getCollectionPage } = fixture();
  getLibraryPage.mockResolvedValue(page);
  await expect(preflightSourceEnumeration(args)).rejects.toMatchObject({ detail: { phase: 'media', reason } });
  expect(getCollectionPage).not.toHaveBeenCalled();
});
test.each(['changed_page_total', 'repeated_source_key'])('validates the second page: %s', async reason => {
  const { args, getLibraryPage } = fixture();
  getLibraryPage.mockResolvedValueOnce(sourcePageFixture([{ external_id: '1' }], { total: 3 }))
    .mockResolvedValueOnce(sourcePageFixture([{ external_id: reason === 'repeated_source_key' ? '1' : '2' }], { offset: 1, total: reason === 'changed_page_total' ? 4 : 3 }));
  await expect(preflightSourceEnumeration(args)).rejects.toMatchObject({ detail: { reason } });
});
test('collection failures are checked before the caller receives any sample for ingestion', async () => {
  const { args, getCollectionPage } = fixture();
  getCollectionPage.mockRejectedValue(Object.assign(new Error('private token and URL'), { response: { status: 403 } }));
  const error = await preflightSourceEnumeration(args).catch(error => error);
  expect(error).toBeInstanceOf(SourcePreflightError);
  expect(error.detail).toMatchObject({ phase: 'collections', reason: 'access_denied' });
  expect(error.message).not.toContain('private');
  expect(error).not.toHaveProperty('cause');
});

test('a recovery canary diagnostic retains its original phase and actionable cause', async () => {
  const { args, getLibraryPage } = fixture();
  const error = new SourcePreflightError('collections', 'access_denied');
  getLibraryPage.mockRejectedValue(error);
  await expect(preflightSourceEnumeration(args)).rejects.toBe(error);
});
test('source changes and owner loss propagate without being relabeled as provider faults', async () => {
  const { args, owner, getLibraryPage } = fixture();
  owner.assertSource.mockRejectedValue(new Error('ingestion_source_changed'));
  await expect(preflightSourceEnumeration(args)).rejects.toThrow('ingestion_source_changed');
  expect(getLibraryPage).not.toHaveBeenCalled();
  owner.assertSource.mockReset();
  const controller = new AbortController();
  args.owner.signal = controller.signal;
  getLibraryPage.mockImplementation(async () => { controller.abort(new Error('ingestion_owner_lost')); throw new Error('transport'); });
  await expect(preflightSourceEnumeration(args)).rejects.toThrow('ingestion_owner_lost');
  expect(getLibraryPage).toHaveBeenCalledTimes(1);
});
test.each([
  [{ response: { status: 401 } }, 'access_denied'], [{ response: { status: 403 } }, 'access_denied'],
  [{ response: { status: 404 } }, 'endpoint_not_found'], [{ response: { status: 429 } }, 'rate_limited'],
  [{ response: { status: 503 } }, 'unavailable'], [{ code: 'HTTP_RESPONSE_TOO_LARGE' }, 'response_too_large'],
  [{ code: 'ETIMEDOUT' }, 'timed_out'], [{ name: 'TimeoutError' }, 'timed_out'],
  [new SourceEnumerationError('private unknown reason'), 'invalid_response'],
  [new TypeError('private'), 'invalid_response'], [new SyntaxError('private'), 'invalid_response'],
  [null, 'unavailable'], [{ code: 'ECONNREFUSED' }, 'unavailable'],
])('maps errors to allowlisted diagnostics without retaining raw messages', (error, reason) => {
  expect(sourcePreflightFailureReason(error)).toBe(reason);
  const failure = new SourcePreflightError('media', reason);
  expect(readSourcePreflightDiagnostic(failure.message)).toEqual(failure.detail);
  expect(failure.message).not.toContain('private');
});
test('historical diagnostics ignore arbitrary error strings, unknown codes and injected suffixes', () => {
  for (const value of [null, {}, 'token=secret', 'Source preflight unavailable (other:unavailable). ', 'Source preflight unavailable (media:__proto__). ']) {
    expect(readSourcePreflightDiagnostic(value)).toBeNull();
  }
  const error = new SourcePreflightError('private-phase', 'private-code');
  expect(error.detail).toMatchObject({ phase: 'media', reason: 'unavailable' });
  const value = readSourcePreflightDiagnostic('Source preflight unavailable (media:unavailable). secret-token');
  expect(JSON.stringify(value)).not.toContain('secret-token');
});
