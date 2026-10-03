/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { normalizeArrId, isValidArrExpectation, verifyArrResource, selectArrResource } from '../services/arrResourceVerification.mjs';

const expected = { identityKey: 'tmdbId', identity: 42, rootFolderPath: '/movies' };
const item = { id: 1, tmdbId: 42, path: '/movies/Title' };

test.each([0, -1, 1.5, 2147483648, NaN, Infinity, null, undefined, {}, true, '42x', '4e2', ' 42 ', ''])
('rejects invalid provider ID %s', value => { expect(normalizeArrId(value)).toBeNull(); });
test.each([1, 2147483647, '42', '0042'])('accepts exact positive int32 ID %s', value => {
  expect(normalizeArrId(value)).toBe(Number(value));
});

test.each([
  ['/movies', '/movies/Title'], ['/movies/', '/movies/Title'], ['/', '/Title'],
  ['D:\\Movies', 'D:/Movies/Title'], ['D:/', 'D:\\Title'],
  ['\\\\nas\\media', '//nas/media/Title'], ['/movies', '/movies/nested/Title'],
])('verifies lexical placement under %s', (root, path) => {
  expect(verifyArrResource({ ...item, path }, { ...expected, rootFolderPath: root })).toBe(true);
});

test.each([
  ['/movies', '/movies-other/Title'], ['/movies', '/other/Title'], ['/movies', '/movies'],
  ['/Movies', '/movies/Title'], ['/movies', '/movies/../other/Title'], ['/movies', '/movies/./Title'],
  ['/movies', 'movies/Title'], ['movies', '/movies/Title'], ['/movies', null],
  ['/movies', '/movies/Title\n'], ['/movies', ' /movies/Title'], ['/', '/'],
  ['/movies', 'C:\\movies\\Title'], ['D:\\Movies', 'E:\\Movies\\Title'],
  ['D:\\Movies', 'D:Movies/Title'], ['/movies', '/movies\\Title'],
  ['\\\\?\\C:\\Movies', '\\\\?\\C:\\Movies\\Title'],
  ['\\\\.\\Movies', '\\\\.\\Movies\\Title'],
])('refuses uncertain placement %s / %s', (root, path) => {
  expect(verifyArrResource({ ...item, path }, { ...expected, rootFolderPath: root })).toBe(false);
});

test.each([{ id: 0 }, { tmdbId: 99 }, { tmdbId: '42wrong' }, { rootFolderPath: '/other' },
  { rootFolderPath: 12 }, { rootFolderPath: 'relative' }])('rejects inconsistent provider evidence %j', change => {
  expect(verifyArrResource({ ...item, ...change }, expected)).toBe(false);
});
test('requires a known identity key and accepts matching normalized evidence', () => {
  expect(isValidArrExpectation({ ...expected, identityKey: '__proto__' })).toBe(false);
  expect(verifyArrResource(item, { ...expected, identity: null })).toBe(false);
  expect(verifyArrResource(null, expected)).toBe(false);
  expect(verifyArrResource({ ...item, id: '1', tmdbId: '42', rootFolderPath: '/movies/' }, expected)).toBe(true);
});
test.each([{}, null, [null], [{ id: 1 }], [item, item], [{ ...item, id: -1 }]])
('does not treat malformed or duplicate reads as absence: %j', response => {
  expect(() => selectArrResource(response, 'tmdbId', 42)).toThrow();
});
test('filters valid provider arrays without truncating IDs', () => {
  expect(selectArrResource([item], 'tmdbId', '42')).toBe(item);
  expect(selectArrResource([item], 'tmdbId', 99)).toBeNull();
  expect(selectArrResource([], 'tvdbId', 1)).toBeNull();
  expect(() => selectArrResource([], 'tmdbId', '42x')).toThrow();
  expect(() => selectArrResource([], 'wrong', 42)).toThrow();
});
