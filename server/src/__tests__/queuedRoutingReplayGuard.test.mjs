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
