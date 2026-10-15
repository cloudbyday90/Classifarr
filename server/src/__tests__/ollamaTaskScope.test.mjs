/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { setTimeout as delay } from 'node:timers/promises';
import { AsyncResource } from 'node:async_hooks';
import { runOllamaTaskScope,getOllamaTaskSource } from '../services/ollamaTaskScope.mjs';
import { QueueTaskProcessorService } from '../services/queueTaskProcessorService.mjs';

const task = (id = 42) => ({ id,task_type: 'classification',attempts: 2,claim_token: 'PRIVATE',
  payload: { id: 999,attempts: 99,title: 'PRIVATE',source: { taskId: 'spoof' } } });
const source = id => ({ version: 1,kind: 'queue_task',taskId: String(id),taskType: 'classification',attempt: 2 });

test('snapshots only queue fields, freezes them, and leaves no context afterward',async () => {
  const input = task();
  await runOllamaTaskScope(input,async () => {
    input.id = 999; input.attempts = 90; await delay(1);
    expect(getOllamaTaskSource()).toEqual(source(42)); expect(Object.isFrozen(getOllamaTaskSource())).toBe(true);
    expect(JSON.stringify(getOllamaTaskSource())).not.toMatch(/PRIVATE|spoof|payload|claim_token/);
  });
  expect(getOllamaTaskSource()).toBeNull();
});

test('concurrent task scopes do not overwrite one another',async () => {
  const result = await Promise.all([11,22,33].map(id => runOllamaTaskScope(task(id),async () => {
    await delay(34-id); return getOllamaTaskSource();
  })));
  expect(result).toEqual([11,22,33].map(source)); expect(getOllamaTaskSource()).toBeNull();
});

test('nested scope restores parent; an invalid task masks rather than inherits it',async () => {
  await runOllamaTaskScope(task(11),async () => {
    await runOllamaTaskScope(task(22),async () => { expect(getOllamaTaskSource()).toEqual(source(22)); });
    await runOllamaTaskScope({},async () => { expect(getOllamaTaskSource()).toBeNull(); });
    expect(getOllamaTaskSource()).toEqual(source(11));
  });
});

test.each([false,true])('finished scope cannot survive through detached async resources, rejection=%s',async reject => {
  let resource;
  const promise = runOllamaTaskScope(task(),async () => {
    resource = new AsyncResource('detached-task-fixture'); await delay(1);
    if (reject) throw new Error('fixture');
  });
  if (reject) await expect(promise).rejects.toThrow('fixture'); else await promise;
  expect(resource.runInAsyncScope(getOllamaTaskSource)).toBeNull(); resource.emitDestroy();
  expect(getOllamaTaskSource()).toBeNull();
});

test.each([null,{},task(0),task(-1),task(Number.MAX_SAFE_INTEGER+1),task('01'),task('9223372036854775808'),
  { ...task(),attempts: undefined },{ ...task(),attempts: '2' },{ ...task(),task_type: 'unknown' }])('legacy invalid task %# stays processable but uncorrelated',async input => {
  expect(await runOllamaTaskScope(input,() => { expect(getOllamaTaskSource()).toBeNull(); return 'processed'; })).toBe('processed');
});

test('maximum bigint task references are preserved exactly as text',async () => {
  await runOllamaTaskScope(task('9223372036854775807'),async () => {
    expect(getOllamaTaskSource().taskId).toBe('9223372036854775807');
  });
});

test.each(['classification','metadata_enrichment','rating_normalization','rebuild_hnsw_index'])('actual queue dispatch scopes %s without changing claim arguments',async type => {
  const input = { ...task(),task_type: type },observed = [];
  const handler = async row => { await delay(1); observed.push({ row,source: getOllamaTaskSource() }); };
  const receiver = { logger: { info() {} },processClassificationTask: handler,processMetadataEnrichmentTask: handler,
    processRatingNormalization: handler,rebuildImageIndexes: handler };
  await QueueTaskProcessorService.prototype.processTask.call(receiver,input);
  expect(observed).toEqual([{ row: input,source: { ...source(42),taskType: type } }]);
  expect(getOllamaTaskSource()).toBeNull();
});
