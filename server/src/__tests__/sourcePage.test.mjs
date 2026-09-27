/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { describe, test, expect } from '@jest/globals';
import { readPlexSourcePage, readEmbySourcePage, sourcePageRequest, sourceKey } from '../services/mediaServers/shared/sourcePage.mjs';
import { SourceEnumerationError } from '../services/sourceEnumerationError.mjs';

const plex = (container, headers) => readPlexSourcePage({ data: { MediaContainer: container }, headers });
const emby = container => readEmbySourcePage({ data: container });

describe('source response envelopes', () => {
  test('preserves Plex body counts, source positions, and unsupported source keys', () => {
    const items = [{ ratingKey: '1', type: 'track' }, { ratingKey: 2, type: 'movie' }];
    expect(plex({ Metadata: items, size: 2, offset: 4, totalSize: 9 }))
      .toEqual({ items, keys: ['1', '2'], offset: 4, total: 9 });
  });
  test('accepts case-insensitive Plex headers and Headers implementations', () => {
    for (const headers of [{ 'X-Plex-Container-Start': '2', 'X-Plex-Container-Total-Size': '3' },
      new Headers({ 'X-Plex-Container-Start': '2', 'X-Plex-Container-Total-Size': '3' })]) {
      expect(plex({ Metadata: [{ ratingKey: 'last' }], size: 1 }, headers)).toMatchObject({ offset: 2, total: 3 });
    }
  });
  test.each(['offset', 'totalSize'])('rejects conflicting Plex %s metadata', field => {
    expect(() => plex({ Metadata: [], [field]: 1 }, {
      'x-plex-container-start': '0', 'x-plex-container-total-size': '0',
    })).toThrow('conflicting_page_metadata');
  });
  test('preserves Emby/Jellyfin total and start index independently of items', () => {
    expect(emby({ Items: [], StartIndex: 7, TotalRecordCount: 7 }))
      .toEqual({ items: [], keys: [], offset: 7, total: 7 });
    expect(emby({ Items: [{ Id: 'film' }] })).toMatchObject({ keys: ['film'], offset: null, total: null });
  });
  test.each([{}, [], null, undefined, 'html'])('rejects absent/invalid Plex and Emby containers: %p', data => {
    expect(() => readPlexSourcePage({ data })).toThrow(SourceEnumerationError);
    if (data && !Array.isArray(data) && typeof data === 'object') expect(() => emby(data)).toThrow('missing_items');
    else expect(() => emby(data)).toThrow('missing_container');
  });
  test('only accepts omitted empty arrays with affirmative zero counts', () => {
    expect(plex({ size: 0, totalSize: 0 })).toMatchObject({ items: [], total: 0 });
    expect(plex({ size: 0, Metadata: null })).toMatchObject({ items: [], total: null });
    expect(emby({ TotalRecordCount: 0 })).toMatchObject({ items: [], total: 0 });
    expect(() => plex({ totalSize: 4 })).toThrow('missing_items');
    expect(() => emby({ TotalRecordCount: 4 })).toThrow('missing_items');
  });
  test.each([null, -1, 0.1, '1', NaN, Infinity, 2147483648])('rejects malformed body counts %p', value => {
    expect(() => plex({ Metadata: [], totalSize: value })).toThrow('invalid_page_count');
    expect(() => emby({ Items: [], TotalRecordCount: value })).toThrow('invalid_page_count');
  });
  test.each(['1.0', '-1', 'Infinity', '2147483648', '99999999999', 'secret\nheader'])('rejects malformed header counts without exposing them: %p', value => {
    expect(() => plex({ Metadata: [] }, { 'x-plex-container-total-size': value })).toThrow('invalid_page_count');
  });
  test.each([{}, 'bad', [null], [{ ratingKey: '' }], Array(1001).fill({ ratingKey: '1' })])('rejects malformed or oversized pages', Metadata => {
    expect(() => plex({ Metadata })).toThrow(SourceEnumerationError);
  });
  test('rejects declared page sizes different from returned count', () => {
    expect(() => plex({ Metadata: [{ ratingKey: '1' }], size: 0 })).toThrow('invalid_page_items');
  });
  test.each([undefined, null, {}, 0, -1, NaN, '', ' ', 'line\nkey', 'x'.repeat(501)])('rejects unusable source keys', key => {
    expect(() => sourceKey(key)).toThrow('invalid_source_key');
  });
  test('validates bounded requests without coercion', () => {
    expect(sourcePageRequest()).toEqual({ offset: 0, limit: 100 });
    expect(sourcePageRequest({ offset: 2147483647, limit: 1000 })).toEqual({ offset: 2147483647, limit: 1000 });
    for (const options of [{ limit: 0 }, { limit: 1001 }, { limit: '1' }, { offset: -1 }, { offset: null }]) {
      expect(() => sourcePageRequest(options)).toThrow(SourceEnumerationError);
    }
  });
});
