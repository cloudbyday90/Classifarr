/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';
import { withRepresentativePreparationReader } from '../../services/inventoryRepresentativePreparationReader.mjs';
import { representativeProfileFixture } from '../helpers/inventoryRepresentativeProfileFixture.mjs';

test('an unjoined batch is drained before the transaction can release its connection', async () => {
  const v = representativeProfileFixture(); let resume, settled = false, escaped;
  const query = jest.fn(() => new Promise(resolve => { resume = resolve; }));
  const work = withRepresentativePreparationReader(query, v.identity, v.snapshot, undefined, (_snapshot, read) => {
    escaped = read([v.snapshot.corpus.documents[0].hash]);
    return { incomplete: true };
  });
  work.then(() => { settled = true; }, () => { settled = true; });
  await setImmediate(); expect(settled).toBe(false);
  resume({ rows: [] });
  await expect(work).rejects.toThrow('reader_active');
  await expect(escaped).rejects.toThrow('reader_closed');
});

test('concurrent and aborted reads reject before issuing additional SQL', async () => {
  const v = representativeProfileFixture(), controller = new AbortController(); let resume;
  const query = jest.fn(() => new Promise(resolve => { resume = resolve; }));
  await expect(withRepresentativePreparationReader(query, v.identity, v.snapshot, controller.signal, async (_snapshot, read) => {
    const hashes = [v.snapshot.corpus.documents[0].hash], first = read(hashes);
    await expect(read(hashes)).rejects.toThrow('batch');
    controller.abort(new Error('cancelled')); resume({ rows: [] });
    await expect(first).rejects.toThrow('cancelled');
    await expect(read(hashes)).rejects.toThrow('cancelled');
  })).rejects.toThrow('cancelled');
  expect(query).toHaveBeenCalledTimes(1);
});
