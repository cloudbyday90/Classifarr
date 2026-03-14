/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const {
  coerceMetadataArray,
  normalizeMetadataList,
  normalizeMetadataListLower,
} = require('../utils/metadataNormalization');

describe('metadataNormalization', () => {
  test('coerces arrays directly and rejects unsupported non-array values', () => {
    expect(coerceMetadataArray(['Documentary'])).toEqual(['Documentary']);
    expect(coerceMetadataArray({ name: 'Documentary' })).toEqual([]);
  });

  test('returns an empty array for malformed JSON strings', () => {
    expect(coerceMetadataArray('[Documentary')).toEqual([]);
  });

  test('returns an empty array when JSON parses successfully but is not an array', () => {
    expect(coerceMetadataArray('{\"name\":\"Documentary\"}')).toEqual([]);
  });

  test('normalizes arrays of strings and name objects', () => {
    expect(
      normalizeMetadataList(['Documentary', { id: 10751, name: 'Family' }, null, { id: 1 }])
    ).toEqual(['Documentary', 'Family']);
  });

  test('normalizes tag and title objects while trimming empty values', () => {
    expect(
      normalizeMetadataList([
        { tag: '  Standup  ' },
        { title: '  Special Event ' },
        { tag: '   ' },
        { title: '' }
      ])
    ).toEqual(['Standup', 'Special Event']);
  });

  test('ignores objects without string-backed name, tag, or title fields', () => {
    expect(
      normalizeMetadataList([{ name: 1 }, { tag: false }, { title: null }])
    ).toEqual([]);
  });

  test('normalizes JSON-stringified arrays', () => {
    expect(
      normalizeMetadataList('[\"Documentary\", {\"name\":\"Family\"}]')
    ).toEqual(['Documentary', 'Family']);
  });

  test('ignores plain non-JSON strings to avoid widening semantics unexpectedly', () => {
    expect(normalizeMetadataList('Documentary')).toEqual([]);
  });

  test('returns lowercase normalized values', () => {
    expect(
      normalizeMetadataListLower([{ name: 'Documentary' }, 'Family'])
    ).toEqual(['documentary', 'family']);
  });
});
