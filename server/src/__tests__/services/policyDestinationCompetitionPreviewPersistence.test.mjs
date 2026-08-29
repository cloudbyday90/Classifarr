/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import {
  POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS,
  loadPolicyDestinationCompetitionCompetitors,
} from '../../services/policyDestinationCompetitionPreviewPersistence.mjs';

describe('policyDestinationCompetitionPreviewPersistence', () => {
  test('uses a static parameterized active same-media-type competitor query', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 24, name: 'Internal only' }] });

    await expect(loadPolicyDestinationCompetitionCompetitors({
      db: { query },
      policyId: 17,
      mediaType: 'movie',
    })).resolves.toEqual([{ id: 24, name: 'Internal only' }]);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('lp.id <> $1');
    expect(sql).toContain('lp.enabled = TRUE');
    expect(sql).toContain('l.is_active = TRUE');
    expect(sql).toContain('l.media_type = $2');
    expect(sql).toContain('LIMIT $3');
    expect(sql).not.toContain('INSERT');
    expect(sql).not.toContain('UPDATE');
    expect(sql).not.toContain('DELETE');
    expect(values).toEqual([
      17,
      'movie',
      POLICY_DESTINATION_COMPETITION_MAXIMUM_COMPETITORS,
    ]);
  });
});
