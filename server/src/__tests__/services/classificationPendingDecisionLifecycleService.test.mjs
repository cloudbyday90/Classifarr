/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';

import {
  buildPendingDecisionIdentity,
  ClassificationPendingDecisionLifecycleService,
} from '../../services/classificationPendingDecisionLifecycleService.mjs';

describe('buildPendingDecisionIdentity', () => {
  test('uses TMDB identity before every weaker form', () => {
    expect(buildPendingDecisionIdentity({
      metadata: { media_item_id: 42 },
      tmdbId: 15030,
      mediaType: 'movie',
      title: 'Deep Water',
      year: 2006,
    })).toEqual({
      version: 'classification.pending_decision_identity.v1',
      key: 'tmdb:movie:15030',
      kind: 'tmdb',
    });
  });

  test('does not merge title-only records', () => {
    expect(buildPendingDecisionIdentity({
      mediaType: 'movie',
      title: 'Deep Water',
      year: 2006,
    })).toBeNull();
  });

  test('scopes opaque media-server item IDs before using them as an identity', () => {
    expect(buildPendingDecisionIdentity({
      metadata: {
        media_server_id: 'jellyfin-primary',
        media_item_id: '97e46e71814b4ed3a56484e2822f0fb4',
      },
      mediaType: 'movie',
    })).toMatchObject({
      key: 'media_server_item:movie:jellyfin-primary:97e46e71814b4ed3a56484e2822f0fb4',
      kind: 'media_server_item',
    });

    expect(buildPendingDecisionIdentity({
      metadata: { media_item_id: 'shared-item-id' },
      mediaType: 'movie',
    })).toBeNull();
  });
});

describe('ClassificationPendingDecisionLifecycleService', () => {
  test('supersedes active predecessors while retaining their historical rows', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 41 }, { id: 40 }] })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 2 });
    const client = { query };
    const database = {
      withTransaction: async (fn) => fn(client),
    };
    const service = new ClassificationPendingDecisionLifecycleService({ db: database });
    const insert = jest.fn().mockResolvedValue(42);

    await expect(service.persist({
      status: 'awaiting_decision',
      identity: { key: 'tmdb:movie:15030' },
      insert,
    })).resolves.toEqual({
      classificationId: 42,
      supersededClassificationIds: [41, 40],
    });

    expect(insert).toHaveBeenCalledWith(client, [41, 40]);
    expect(query.mock.calls[2][0]).toContain("SET status = 'reclassified'");
    expect(query.mock.calls[3][0]).toContain('UPDATE app_notifications');
    expect(query.mock.calls[4][0]).toContain("'superseded_by_classification_id'");
  });

  test('leaves completed records outside the pending decision invariant', async () => {
    const insert = jest.fn().mockResolvedValue(70);
    const service = new ClassificationPendingDecisionLifecycleService({ db: {} });

    await expect(service.persist({
      status: 'completed',
      identity: { key: 'tmdb:movie:15030' },
      insert,
    })).resolves.toEqual({
      classificationId: 70,
      supersededClassificationIds: [],
    });
    expect(insert).toHaveBeenCalledWith(null, []);
  });
});
