/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { expect, jest, test } from '@jest/globals';
import {
  HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES,
  readHeldOutSemanticStudyInventoryAuditCandidates,
} from '../../services/heldOutSemanticStudyInventoryAuditSource.mjs';

function row(id) {
  return {
    content_rating: 'PG', genres: ['Drama'], media_type: 'movie', metadata: {},
    study_stratum: 'ordinary', tmdb_id: id, title: `Private title ${id}`, year: 2024,
    history_metadata: {},
  };
}

test('reads a bounded canonical audit population and exposes truncation without outputting metadata', async () => {
  const query = jest.fn(async () => ({ rows: Array.from({ length: 25 }, (_, index) => row(index + 1)) }));
  const result = await readHeldOutSemanticStudyInventoryAuditCandidates({
    query,
    maximumCandidateCount: 24,
  });

  expect(result).toMatchObject({ truncated: true });
  expect(result.candidates).toHaveLength(24);
  expect(query.mock.calls[0][1]).toEqual([30, 25]);
  expect(query.mock.calls[0][0]).toContain('LIMIT $2');
  await expect(readHeldOutSemanticStudyInventoryAuditCandidates({
    query,
    maximumCandidateCount: HELD_OUT_SEMANTIC_STUDY_INVENTORY_AUDIT_MAXIMUM_CANDIDATES + 1,
  })).rejects.toThrow('invalid_held_out_inventory_audit_request');
});
