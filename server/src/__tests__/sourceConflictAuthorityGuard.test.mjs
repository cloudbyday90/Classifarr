/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import {
  SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS,
  sourceConflictAuthorityExclusionForMediaServerItem,
  sourceConflictAuthorityPredicateForMediaServerItem,
} from '../services/sourceConflictAuthorityGuard.mjs';

test('matches a fresh conflict to the exact current source identity', () => {
  const predicate = sourceConflictAuthorityPredicateForMediaServerItem('$4');
  expect(SOURCE_CONFLICT_AUTHORITY_RETENTION_DAYS).toBe(30);
  expect(predicate).toContain('FROM media_source_observations AS source_conflict');
  expect(predicate).toContain('source_conflict.library_id = msi.library_id');
  expect(predicate).toContain('source_conflict.media_server_id = msi.media_server_id');
  expect(predicate).toContain('source_conflict.external_id = msi.external_id');
  expect(predicate).toContain("statement_timestamp()\n        - $4::integer * INTERVAL '1 day'");
  expect(sourceConflictAuthorityExclusionForMediaServerItem('$4')).toBe(`NOT ${predicate}`);
});

test.each(['$0', '$01', '?', '$4; DROP TABLE media_server_items', 'retention'])
  ('rejects an unsafe SQL placeholder: %s', placeholder => {
    expect(() => sourceConflictAuthorityPredicateForMediaServerItem(placeholder)).toThrow('Invalid source conflict retention parameter');
  });
