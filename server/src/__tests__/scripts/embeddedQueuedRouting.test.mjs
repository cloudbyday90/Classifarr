/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runQueuedRoutingFixture } from '../../scripts/embeddedIsolationDrill/queuedRoutingFixture.mjs';
import { queuedRoutingData } from '../../scripts/embeddedIsolationDrill/queuedRoutingState.mjs';

function fixture(fault) {
  const rows = ['movie', 'tv'].map((type, index) => ({ id: String(index + 1), media_type: type,
    status: 'pending', claim_token: null, attempts: 0, routing_classification_id: null, history_count: 0 }));
  const counts = { tmdb: 0, movieReads: 0, tvReads: 0, movieAdds: 0, tvAdds: 0, healthReads: 0, unexpected: 0 };
  let accepted, running = false, expired, time = 0;
  const close = jest.fn();
  const data = jest.fn(async mode => {
    if (mode.startsWith('release-')) {
      const type = mode.slice(8), row = rows.find(value => value.media_type === type);
      Object.assign(row, { status: 'processing', claim_token: '3ab9fe9d-5ed3-4d99-94f0-598b2ad02f96',
        routing_classification_id: row.id, history_count: 1, method: 'policy_auto', history_status: 'completed',
        details: { routing: 'automatic_routing_pending', retained: true } });
      counts[`${type}Reads`]++; counts[`${type}Adds`]++;
      if (fault !== 'no-admission') accepted(type);
    }
    if (mode.startsWith('expire-')) { expect(running).toBe(false); expired = mode.slice(7); }
    return JSON.parse(JSON.stringify(rows));
  });
  return { data, counts, close,
    providerFactory: jest.fn(async options => { expect(options.hideAccepted).toBe(true); accepted = options.holdAfterAdd; return { counts, close }; }),
    start: jest.fn(() => { running = true; counts.healthReads += 8; return { child: {} }; }),
    ready: jest.fn(async () => {
      if (!expired) return;
      const row = rows.find(value => value.media_type === expired);
      Object.assign(row, { status: 'completed', claim_token: null, result: { recovered: true, classification_id: row.id,
        routingOutcome: { routeResult: { attempted: true, routed: false, reason: 'automatic_routing_unconfirmed' } } } });
      if (fault === 'duplicate-post') counts[`${expired}Adds`]++;
      if (fault === 'replay-read') counts[`${expired}Reads`]++;
      if (fault === 'new-history') row.history_count++;
      if (fault === 'changed-decision') row.details.retained = false;
      if (fault === 'false-success') row.result.routingOutcome.routeResult.routed = true;
      if (fault === 'new-reference') row.routing_classification_id = '999';
      expired = null;
    }),
    stop: jest.fn(async () => { running = false; }),
    crash: jest.fn(async () => { running = false; }),
    wait: async () => {}, now: () => { time += 1000; return time; },
  };
}

test('requires observed adds, exits before advancing deadlines, and reclaims both commands without replay', async () => {
  const dependencies = fixture();
  expect(await runQueuedRoutingFixture(dependencies)).toEqual({ acceptedAdds: 2, duplicateAdds: 0,
    replayReads: 0, recoveredCommands: 2, syntheticDeadlineAdvances: 2 });
  expect(dependencies.crash).toHaveBeenCalledTimes(2);
  expect(dependencies.close).toHaveBeenCalledTimes(1);
  expect(dependencies.data).toHaveBeenLastCalledWith('disable');
});

test.each(['no-admission', 'duplicate-post', 'replay-read', 'new-history', 'changed-decision', 'false-success', 'new-reference'])
('%s fails evidence and closes the provider', async fault => {
  const dependencies = fixture(fault);
  await expect(runQueuedRoutingFixture(dependencies)).rejects.toThrow();
  expect(dependencies.close).toHaveBeenCalledTimes(1);
  expect(dependencies.stop).toHaveBeenCalled();
  if (fault === 'no-admission') expect(dependencies.crash).not.toHaveBeenCalled();
});

test('occupied fixture refuses seeding before mutation', async () => {
  const query = jest.fn(async () => ({ rows: [{ n: 1 }] }));
  await expect(queuedRoutingData({ query }, 'seed')).rejects.toThrow();
  expect(query).toHaveBeenCalledTimes(1);
});

test.each(['expire-movie', 'release-tv'])('%s requires exactly one expected task', async mode => {
  const query = jest.fn(async () => ({ rowCount: 0 }));
  await expect(queuedRoutingData({ query }, mode)).rejects.toThrow('queued_fixture_transition_failed');
  expect(query).toHaveBeenCalledTimes(1);
});
