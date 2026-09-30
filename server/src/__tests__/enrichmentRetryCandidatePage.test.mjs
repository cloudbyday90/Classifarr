/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { readEnrichmentRetryPage, retryCandidateParameters } from '../services/enrichmentRetryCandidates.mjs';
import { sourceConflictPageExclusionForMediaServerItem } from '../services/sourceConflictAuthorityGuard.mjs';
import { hasEnrichmentRetryDispatchCandidate } from '../services/enrichmentRetryDispatchCandidate.mjs';

test.each([0,-1,51,1.5,NaN,Infinity])('rejects invalid page size %s without database work', async limit => {
  const db={query:jest.fn()};
  await expect(readEnrichmentRetryPage(db,'omdb',null,limit)).rejects.toThrow('invalid_retry_page');
  expect(db.query).not.toHaveBeenCalled();
});

test.each([1,50])('binds cursor fields and returns unchanged row hints for size %s', async limit => {
  const rows=[{queue_id:3,priority:1,retry_created_at:null}];
  const db={query:jest.fn().mockResolvedValue({rows})};
  expect(await readEnrichmentRetryPage(db,'omdb',rows[0],limit)).toBe(rows);
  const [sql,params]=db.query.mock.calls[0];
  expect(params).toEqual([...retryCandidateParameters('omdb'),1,null,3,limit]);
  expect(sql).toContain('JOIN LATERAL');
  expect(sql).toContain('WHERE id=erq.media_item_id OFFSET 0');
  expect(sql).toContain('retry_contexts AS MATERIALIZED');
  expect(sql).toContain('erq.created_at NULLS LAST');
  expect(sql).toContain('due.next_attempt_at <= statement_timestamp()');
  expect(sql).toContain('waiting.retry_wait_context IS NOT NULL');
  expect(sql).toContain('waiting.retry_wait_until = waiting.next_attempt_at');
  expect(sql).toContain('waiting.enrichment_type = $1');
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(sql).not.toMatch(/FOR UPDATE|UPDATE enrichment_retry_queue|UNION ALL/);
});

test('first page has no cursor and query errors propagate without fallback writes', async () => {
  const db={query:jest.fn().mockRejectedValue(new Error('database unavailable'))};
  await expect(readEnrichmentRetryPage(db,'tavily',null,50)).rejects.toThrow('database unavailable');
  expect(db.query.mock.calls[0][1].slice(4)).toEqual([null,null,null,50]);
  expect(db.query).toHaveBeenCalledTimes(1);
});

test('unknown types and unsafe conflict placeholders cannot reach SQL', async () => {
  const db={query:jest.fn()};
  await expect(readEnrichmentRetryPage(db,'music',null,50)).rejects.toThrow('unsupported_retry_type');
  expect(db.query).not.toHaveBeenCalled();
  expect(()=>sourceConflictPageExclusionForMediaServerItem('$4;DROP TABLE x')).toThrow('Invalid');
  expect(sourceConflictPageExclusionForMediaServerItem('$4')).toContain('LIMIT 1) IS NULL');
});

test.each([{rows:[]},{rows:[{id:1}]}])('dispatch returns an availability hint with no writes or second query', async ({rows}) => {
  const db={query:jest.fn().mockResolvedValue({rows})};
  expect(await hasEnrichmentRetryDispatchCandidate(db,'web_search')).toBe(rows.length>0);
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(db.query.mock.calls[0][1]).toEqual(['web_search']);
  expect(db.query.mock.calls[0][0]).toContain('waiting.retry_wait_until = waiting.next_attempt_at');
  await expect(hasEnrichmentRetryDispatchCandidate(db,'track')).rejects.toThrow('unsupported_retry_type');
  expect(db.query).toHaveBeenCalledTimes(1);
});
