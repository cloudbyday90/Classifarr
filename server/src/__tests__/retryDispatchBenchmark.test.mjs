/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { measureRetryDispatch } from '../scripts/retryQueryBenchmark/dispatch.mjs';

test.each(['mixed','all_waiting'])('dispatch benchmark verifies availability for %s without assuming ordered IDs', async scenario => {
  const db={query:jest.fn(async (sql,params)=> {
    if (sql.startsWith('SELECT current_schema')) return {rows:[{name:'retry_query_benchmark',installed:true}]};
    if (sql.startsWith('EXPLAIN')) return {rows:[{'QUERY PLAN':[{Plan:{}}]}]};
    if (sql.startsWith('SELECT erq.id')) return {rows:scenario==='all_waiting'?[]:[{id:{omdb:3,web_search:1,tavily:2}[params[0]]}]};
    return {rows:[]};
  })};
  const rows=await measureRetryDispatch(db,scenario);
  expect(rows).toHaveLength(6);
  expect(rows.every(row=>row.availabilityVerified&&row.repetitions.length===3)).toBe(true);
  expect(db.query.mock.calls.some(([sql])=>/^(UPDATE|DELETE|INSERT|CREATE|DROP)/.test(sql))).toBe(false);
});

test.each(['count','type'])('dispatch benchmark rejects a %s mismatch', async failure => {
  const db={query:jest.fn(async sql=> ({rows:sql.startsWith('SELECT current_schema')
    ? [{name:'retry_query_benchmark',installed:true}]:failure==='count'?[]:[{id:2}]}))};
  await expect(measureRetryDispatch(db,'mixed')).rejects.toThrow('mismatch');
});
