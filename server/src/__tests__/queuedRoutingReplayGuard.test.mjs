/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { QueuedRoutingReplayGuard, buildQueuedRoutingReplay } from '../services/queuedRoutingReplayGuard.mjs';

test.each([null, undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '01', '1;DELETE', '9223372036854775808'])
('invalid command reference %s cannot access the database', async id => {
  const db = { withTransaction: jest.fn() };
  await expect(new QueuedRoutingReplayGuard({ db }).read({ id, claim_token: '3ab9fe9d-5ed3-4d99-94f0-598b2ad02f96' }))
    .rejects.toThrow('invalid_reference');
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test('missing historical data remains unknown, not permission for an add', () => {
  expect(buildQueuedRoutingReplay({ routing_classification_id: '7' })).toMatchObject({
    classification_id: '7', method: null, destination: { libraryId: null, libraryName: null },
    routingOutcome: { routeResult: { routed: false, reason: 'automatic_routing_unconfirmed' } },
  });
});

test('admission composes only fixed SQL while classification values stay parameterized', async () => {
  const query = jest.fn(async text => {
    if (text.includes('SELECT routing_classification_id')) return { rows: [{ routing_classification_id: null, deadline: '2026-10-04T00:00:00Z' }] };
    if (text.includes('SELECT clock_timestamp()')) return { rows: [{ live: true }] };
    return { rows: [], rowCount: 1 };
  });
  const db = { withTransaction: jest.fn(work => work({ query })) };
  const guard = new QueuedRoutingReplayGuard({ db });
  const task = { id: 8, claim_token: '3ab9fe9d-5ed3-4d99-94f0-598b2ad02f96' };
  await guard.admit(task, 41);
  await guard.admit(task, 42);
  const updates = query.mock.calls.filter(([text]) => text.includes('UPDATE classification_history'));
  expect(updates).toHaveLength(2);
  expect(updates[0][0]).toBe(updates[1][0]);
  expect(updates[0][0]).toMatch(/WHERE id = \$4\s+AND status='completed' AND library_id IS NOT NULL RETURNING id$/);
  expect(updates.map(([, values]) => values)).toEqual([
    ['automatic_routing_pending', null, null, 41], ['automatic_routing_pending', null, null, 42],
  ]);
  db.withTransaction.mockClear();
  await expect(guard.admit(task, '1;DELETE')).rejects.toThrow('invalid_reference');
  expect(db.withTransaction).not.toHaveBeenCalled();
});
