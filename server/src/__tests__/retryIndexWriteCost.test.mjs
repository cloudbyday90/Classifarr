/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { measureRetryIndexWriteCost } from '../scripts/retryQueryBenchmark/writeCost.mjs';

test.each([false,true])('synthetic index and write cost always restore savepoints, including error %s', async fail => {
  const db={query:jest.fn(async sql=> {
    if (sql.startsWith('SELECT current_schema')) return {rows:[{name:'retry_query_benchmark',installed:true}]};
    if (sql.includes('pg_relation_size')) return {rows:[{bytes:'8192'}]};
    if (sql.startsWith('EXPLAIN')) {
      if (fail) throw new Error('write failed');
      return {rows:[{'QUERY PLAN':[{Plan:{'Actual Rows':1000}}]}]};
    }
    return {rows:[]};
  })};
  const work=measureRetryIndexWriteCost(db);
  if (fail) await expect(work).rejects.toThrow('write failed');
  else {
    const report=await work;
    expect(report).toMatchObject({indexBytes:8192,maxRowsPerWrite:1000});
    expect(report.measurements).toHaveLength(6);
    expect(report.measurements.every(item=>item.repetitions.length===3)).toBe(true);
    expect(db.query.mock.calls.filter(([sql])=>sql.startsWith('EXPLAIN')).every(([sql])=>sql.includes('WHERE id<=1000'))).toBe(true);
  }
  expect(db.query.mock.calls.slice(-2)).toEqual([
    ['ROLLBACK TO SAVEPOINT retry_benchmark_write_index'],['RELEASE SAVEPOINT retry_benchmark_write_index'],
  ]);
});
