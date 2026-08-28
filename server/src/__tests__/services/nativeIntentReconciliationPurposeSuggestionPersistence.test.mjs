/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  loadNativeIntentReconciliationPurposeSuggestionRecord,
} from '../../services/nativeIntentReconciliationPurposeSuggestionPersistence.mjs';

describe('nativeIntentReconciliationPurposeSuggestionPersistence', () => {
  test('selects only bounded profile fields for the requested policy', async () => {
    const db = {
      query: jest.fn().mockResolvedValue({ rows: [{ policy_id: 17 }] }),
    };

    await expect(loadNativeIntentReconciliationPurposeSuggestionRecord({ db, policyId: 17 }))
      .resolves.toEqual({ policy_id: 17 });

    const [query, params] = db.query.mock.calls[0];
    expect(params).toEqual([17]);
    expect(query).toContain('profile.item_count');
    expect(query).toContain('profile.genre_distribution');
    expect(query).not.toContain('profile.*');
    expect(query).not.toContain('media_server_items');
    expect(query).not.toContain('policy_intent_data');
  });
});
