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
  POLICY_COHORT_SIMULATION_DETERMINISTIC_METHODS,
  POLICY_COHORT_SIMULATION_HISTORY_STATUSES,
  loadPolicyCohortSimulationContext,
  loadPolicyCohortSimulationItems,
} from '../../services/policyCohortSimulationPersistence.mjs';

describe('policyCohortSimulationPersistence', () => {
  test('derives policy scope on the server and loads attached preset configuration internally', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 17, library_id: 23 }] });

    await expect(loadPolicyCohortSimulationContext({
      db: { query },
      policyId: 17,
    })).resolves.toEqual({ id: 17, library_id: 23 });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('WHERE lp.id = $1');
    expect(sql).toContain('jsonb_agg');
    expect(values).toEqual([17]);
  });

  test('uses a static bounded read-only historic query with fixed method and status allow-lists', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 9, title: 'Not returned by API' }] });
    const cutoff = new Date('2026-05-31T00:00:00.000Z');

    await expect(loadPolicyCohortSimulationItems({
      db: { query },
      mediaType: 'movie',
      cutoff,
      maximumItems: 25,
    })).resolves.toEqual([{ id: 9, title: 'Not returned by API' }]);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain('SELECT');
    expect(sql).toContain('LIMIT $5');
    expect(sql).not.toContain('INSERT');
    expect(sql).not.toContain('UPDATE');
    expect(sql).not.toContain('DELETE');
    expect(values).toEqual([
      'movie',
      cutoff,
      POLICY_COHORT_SIMULATION_DETERMINISTIC_METHODS,
      POLICY_COHORT_SIMULATION_HISTORY_STATUSES,
      25,
    ]);
  });
});
