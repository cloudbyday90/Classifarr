/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { withInventoryProspectiveActivity } from '../../services/inventoryProspectiveActivity.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';

const noCaptures = () => evaluateInventoryProspectiveOutcomes([]);

test('distinguishes quiet intake from classifications without complete comparisons', () => {
  const quiet = withInventoryProspectiveActivity(noCaptures(), { recorded_movie_tv_events: 0 });
  expect(quiet).toMatchObject({ status: 'awaiting_eligible_outcomes', promotionAllowed: false,
    activity: { recordedMovieTvEvents: 0, capped: false },
    evidenceState: { phase: 'awaiting_classification_intake', missing: ['recorded_movie_tv_classifications'] } });
  const ineligible = withInventoryProspectiveActivity(noCaptures(), { recorded_movie_tv_events: 1 });
  expect(ineligible.evidenceState).toEqual({ phase: 'awaiting_live_comparisons', missing: ['complete_live_comparisons'] });
  expect(ineligible.activity).toEqual({ recordedMovieTvEvents: 1, capped: false });
  expect(ineligible.providerCalls).toBe(0);
  expect(ineligible.routingChanges).toBe(0);
});

test('keeps existing pending-outcome state when a frozen comparison exists', () => {
  const { capture } = inventoryRankingShadowFixture();
  const report = evaluateInventoryProspectiveOutcomes([{ classification_id: 1, tmdb_id: 123, media_type: 'movie',
    capture, recorded_at: capture.capturedAt, outcomes: [] }]);
  expect(withInventoryProspectiveActivity(report, { recorded_movie_tv_events: 1 }).evidenceState)
    .toEqual({ phase: 'awaiting_operator_outcomes', missing: ['exact_event_outcomes'] });
});

test('marks the 5,001st event as a lower-bound sentinel, not an exact population', () => {
  expect(withInventoryProspectiveActivity(noCaptures(), { recorded_movie_tv_events: 5000 }).activity)
    .toEqual({ recordedMovieTvEvents: 5000, capped: false });
  expect(withInventoryProspectiveActivity(noCaptures(), { recorded_movie_tv_events: 5001 }).activity)
    .toEqual({ recordedMovieTvEvents: 5001, capped: true });
  const largerCapturedCohort = { coverage: { captured: 6000 }, evidenceState: { phase: 'awaiting_operator_outcomes' } };
  expect(withInventoryProspectiveActivity(largerCapturedCohort, { recorded_movie_tv_events: 5001 }).activity.capped)
    .toBe(true);
});

test.each([null, -1, 5002, 1.5, '0', undefined])('rejects malformed activity count: %j', count => {
  expect(() => withInventoryProspectiveActivity(noCaptures(), { recorded_movie_tv_events: count }))
    .toThrow('inventory_prospective_activity_invalid');
});

test('fails closed when recorded events cannot cover captured comparisons', () => {
  expect(() => withInventoryProspectiveActivity({ coverage: { captured: 1 } }, { recorded_movie_tv_events: 0 }))
    .toThrow('inventory_prospective_activity_invalid');
  expect(() => withInventoryProspectiveActivity({ coverage: { captured: -1 } }, { recorded_movie_tv_events: 0 }))
    .toThrow('inventory_prospective_activity_invalid');
});
