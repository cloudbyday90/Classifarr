/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import {
  buildClassificationRoutingMetadataUpdate,
  ClassificationRoutingMetadataPersistenceService,
} from '../../services/classificationRoutingMetadataPersistence.mjs';

describe('classificationRoutingMetadataPersistence', () => {
  test('builds a parameterized patch that preserves existing decision detail keys', () => {
    const statement = buildClassificationRoutingMetadataUpdate({
      classificationId: 42,
      routing: 'routed',
      routingError: null,
      status: 'routed',
    });

    expect(statement.values).toEqual(['routed', null, 'routed', 42]);
    expect(statement.text).toContain("COALESCE(metadata, '{}'::jsonb)");
    expect(statement.text).toContain("-> 'classification_details'");
    expect(statement.text).toContain("- 'routing_error'");
    expect(statement.text).toContain("jsonb_build_object('routing', $1::text)");
    expect(statement.text).not.toContain('SET metadata = $1::jsonb');
  });

  test('replaces a stale routing error only when a bounded replacement is supplied', () => {
    const statement = buildClassificationRoutingMetadataUpdate({
      classificationId: '7',
      routing: 'missing_arr_id',
      routingError: 'API Error',
    });

    expect(statement.values).toEqual(['missing_arr_id', 'API Error', null, 7]);
  });

  test('rejects invalid IDs and unbounded routing inputs before reaching the database', () => {
    expect(() => buildClassificationRoutingMetadataUpdate({
      classificationId: 0,
      routing: 'routed',
    })).toThrow(TypeError);
    expect(() => buildClassificationRoutingMetadataUpdate({
      classificationId: 7,
      routing: 'x'.repeat(121),
    })).toThrow(TypeError);
  });

  test('executes only the parameterized routing patch', async () => {
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    const service = new ClassificationRoutingMetadataPersistenceService({ db: { query } });

    await service.persist({
      classificationId: 9,
      routing: 'threshold_not_met',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE classification_history'),
      ['threshold_not_met', null, null, 9],
    );
  });
});
