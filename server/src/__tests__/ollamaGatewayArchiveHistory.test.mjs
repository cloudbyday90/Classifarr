/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { readArchiveHistory } from '../ollamaGateway/archiveHistoryReader.mjs';
import { cleanupFailureReason } from '../ollamaGateway/cleanupFailure.mjs';

const client = (history_count,history_bytes) => ({ query:async () => ({ rows:[{ id:'fixture',history_count,history_bytes }] }) });
test('empty history returns no synthetic sentinel row',async () => {
  expect(await readArchiveHistory(client(0,0))).toEqual([]);
});
test('exact byte bound is accepted, one extra byte refuses without truncation',async () => {
  expect(await readArchiveHistory(client(1,8388608))).toEqual([{ id:'fixture' }]);
  await expect(readArchiveHistory(client(1,8388609))).rejects.toMatchObject({ code:'gateway_archive_history_size_limit' });
});
test.each([[-1,0],[1,-1],[1,NaN],[1,Infinity],['1',0],[1,'10']])('invalid SQL budget %s/%s fails closed',async (count,bytes) => {
  await expect(readArchiveHistory(client(count,bytes))).rejects.toMatchObject({ code:'gateway_archive_history_size_limit' });
});
test('row count refusal takes priority and cleanup preserves the sanitized diagnostic',async () => {
  await expect(readArchiveHistory(client(10001,8388609))).rejects.toMatchObject({ code:'gateway_archive_job_capacity' });
  expect(cleanupFailureReason({ code:'gateway_archive_history_size_limit',message:'private detail' })).toBe('gateway_archive_history_size_limit');
});
