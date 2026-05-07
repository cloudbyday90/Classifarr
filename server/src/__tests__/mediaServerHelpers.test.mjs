/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computeLibraryDiff } from '../routes/helpers/mediaServerHelpers.mjs';

describe('computeLibraryDiff', () => {
  const makeExisting = (overrides = {}) => ({
    id: 1,
    external_id: 'ext-1',
    name: 'Movies',
    media_type: 'movie',
    arr_type: 'radarr',
    ...overrides,
  });

  const makeRemote = (overrides = {}) => ({
    external_id: 'ext-1',
    name: 'Movies',
    media_type: 'movie',
    ...overrides,
  });

  describe('empty inputs', () => {
    test('returns all empty when both arrays are empty', () => {
      const result = computeLibraryDiff([], []);
      expect(result).toEqual({ toInsert: [], toUpdate: [], toDelete: [], retained: [] });
    });

    test('returns all remote as toInsert when no existing rows', () => {
      const remote = [makeRemote(), makeRemote({ external_id: 'ext-2', name: 'TV', media_type: 'tv' })];
      const result = computeLibraryDiff(remote, []);
      expect(result.toInsert).toHaveLength(2);
      expect(result.toInsert[0]).toMatchObject({ external_id: 'ext-1', arrType: 'radarr' });
      expect(result.toInsert[1]).toMatchObject({ external_id: 'ext-2', arrType: 'sonarr' });
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDelete).toHaveLength(0);
      expect(result.retained).toHaveLength(0);
    });

    test('returns all existing as toDelete when remote is empty', () => {
      const existing = [makeExisting(), makeExisting({ id: 2, external_id: 'ext-2' })];
      const result = computeLibraryDiff([], existing);
      expect(result.toDelete).toHaveLength(2);
      expect(result.toInsert).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.retained).toHaveLength(0);
    });
  });

  describe('exact match — no changes needed', () => {
    test('does not insert, update, or delete when remote matches existing exactly', () => {
      const existing = [makeExisting()];
      const remote = [makeRemote()];
      const result = computeLibraryDiff(remote, existing);
      expect(result.toInsert).toHaveLength(0);
      expect(result.toUpdate).toHaveLength(0);
      expect(result.toDelete).toHaveLength(0);
      expect(result.retained).toHaveLength(1);
      expect(result.retained[0]).toMatchObject({ external_id: 'ext-1', name: 'Movies' });
    });
  });

  describe('name change triggers update', () => {
    test('adds to toUpdate when remote name differs', () => {
      const existing = [makeExisting({ name: 'Old Name' })];
      const remote = [makeRemote({ name: 'New Name' })];
      const result = computeLibraryDiff(remote, existing);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0]).toEqual({
        id: 1,
        name: 'New Name',
        media_type: 'movie',
        arr_type: 'radarr',
      });
      expect(result.retained).toHaveLength(1);
      expect(result.retained[0].name).toBe('New Name');
    });
  });

  describe('media_type change triggers update', () => {
    test('updates arr_type when media_type changes from movie to tv', () => {
      const existing = [makeExisting({ media_type: 'movie', arr_type: 'radarr' })];
      const remote = [makeRemote({ media_type: 'tv' })];
      const result = computeLibraryDiff(remote, existing);
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].arr_type).toBe('sonarr');
      expect(result.toUpdate[0].media_type).toBe('tv');
    });
  });

  describe('arr_type resolution', () => {
    test('resolves radarr for movie type', () => {
      const result = computeLibraryDiff([makeRemote({ media_type: 'movie' })], []);
      expect(result.toInsert[0].arrType).toBe('radarr');
    });

    test('resolves sonarr for tv type', () => {
      const result = computeLibraryDiff([makeRemote({ media_type: 'tv' })], []);
      expect(result.toInsert[0].arrType).toBe('sonarr');
    });

    test('resolves null for unknown type', () => {
      const result = computeLibraryDiff([makeRemote({ media_type: 'music' })], []);
      expect(result.toInsert[0].arrType).toBeNull();
    });
  });

  describe('partial sync', () => {
    test('handles mixed insert, update, retain and delete in one call', () => {
      const existing = [
        makeExisting({ id: 1, external_id: 'keep', name: 'Keep', media_type: 'movie', arr_type: 'radarr' }),
        makeExisting({ id: 2, external_id: 'update', name: 'Old', media_type: 'movie', arr_type: 'radarr' }),
        makeExisting({ id: 3, external_id: 'gone', name: 'Removed', media_type: 'movie', arr_type: 'radarr' }),
      ];
      const remote = [
        { external_id: 'keep', name: 'Keep', media_type: 'movie' },
        { external_id: 'update', name: 'Updated', media_type: 'movie' },
        { external_id: 'new', name: 'New Library', media_type: 'tv' },
      ];

      const result = computeLibraryDiff(remote, existing);

      expect(result.toInsert).toHaveLength(1);
      expect(result.toInsert[0].external_id).toBe('new');
      expect(result.toInsert[0].arrType).toBe('sonarr');

      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0]).toEqual({ id: 2, name: 'Updated', media_type: 'movie', arr_type: 'radarr' });

      expect(result.toDelete).toHaveLength(1);
      expect(result.toDelete[0].external_id).toBe('gone');

      expect(result.retained).toHaveLength(2);
      const retainedIds = result.retained.map((r) => r.external_id);
      expect(retainedIds).toContain('keep');
      expect(retainedIds).toContain('update');
    });
  });

  describe('retained carries merged metadata', () => {
    test('retained record uses remote name but existing id and other db fields', () => {
      const existing = [makeExisting({ id: 42, external_id: 'lib', name: 'Old', media_type: 'movie', arr_type: 'radarr', extra_field: 'db-value' })];
      const remote = [{ external_id: 'lib', name: 'New', media_type: 'movie' }];
      const result = computeLibraryDiff(remote, existing);
      expect(result.retained[0].id).toBe(42);
      expect(result.retained[0].name).toBe('New');
      expect(result.retained[0].extra_field).toBe('db-value');
    });
  });
});
