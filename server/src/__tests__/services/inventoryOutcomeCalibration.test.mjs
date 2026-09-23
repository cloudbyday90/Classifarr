/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { benchmarkInventoryOutcomeCalibration } from '../../services/inventoryOutcomeCalibration.mjs';
import { prepareInventoryOutcomeLabels, INVENTORY_OUTCOME_LABEL_SQL } from '../../services/inventoryOutcomeLabels.mjs';
import { inventoryCompanyFixture } from '../fixtures/inventoryCompanyFixture.mjs';

const options = { seed: 'outcome-study-20260922', size: 300, folds: 3 };
const feedback = ({ rows }) => rows.map(row => ({ media_type: row.media_type, tmdb_id: row.tmdb_id,
  selected_library_id: row.library_id, was_correction: true }));

test('300 grouped operator corrections measure a shadow combination across movie and TV libraries', () => {
  const fixture = inventoryCompanyFixture();
  const report = benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: feedback(fixture) }, options);
  expect(report).toMatchObject({ protocol: 'inventory_operator_outcome_shadow_v1', status: 'diagnostic_only',
    sampleSize: 300, promotionAllowed: false, routingChanges: 0, providerCalls: 0 });
  expect(report.labelCoverage.corrections).toBe(360);
  for (const type of ['movie', 'tv']) {
    expect(report.media[type]).toMatchObject({ sampled: 150, corrections: 150, companyObserved: 150,
      baselineDecisions: 0, combinedDecisions: 150, combinedMatches: 150, regressions: 0 });
  }
  expect(JSON.stringify(report)).not.toMatch(/Producer|Synthetic|tmdb:|company_observation|libraryId|tmdb_id/);
  expect(benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: feedback(fixture) }, options)).toEqual(report);
});

test('contradictory choices are excluded even when one choice is absent from current inventory', () => {
  const fixture = inventoryCompanyFixture(2), labels = feedback(fixture);
  fixture.rows.push({ ...fixture.rows[0], library_id: 2 });
  labels.push({ ...labels[0], selected_library_id: 2 });
  labels.push({ ...labels[1], selected_library_id: 3 });
  labels.push({ ...labels[2], tmdb_id: 999999 });
  const report = benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: labels }, options);
  expect(report.labelCoverage).toMatchObject({ eligibleRows: 15, conflictingIdentities: 2,
    absentFromCurrentInventory: 1, withoutInventoryDescription: 1, labeledIdentities: 10 });
  expect(report.sampleSize).toBe(10);
});

test('a correction awaiting placement or sync remains a label', () => {
  const result = prepareInventoryOutcomeLabels([{ media_type: 'movie', tmdb_id: 3,
    selected_library_id: 2, was_correction: true }], [{ key: 'movie:3', libraryIds: [1] }],
  [{ id: 1, media_type: 'movie' }, { id: 2, media_type: 'movie' }]);
  expect(result.labels.get('movie:3')).toEqual({ libraryId: 2, kind: 'correction' });
  expect(result.coverage).toMatchObject({ absentFromCurrentInventory: 1, labeledIdentities: 1 });
});

test('missing company observations retain the baseline and never imply a company gain', () => {
  const fixture = inventoryCompanyFixture(3);
  fixture.rows = fixture.rows.map(row => ({ ...row, studio: `studio-${row.library_id}`, company_observation: null }));
  const report = benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: feedback(fixture) }, options);
  expect(report.media.movie).toMatchObject({ companyObserved: 0, gains: 0, regressions: 0, changed: 0 });
  expect(report.media.tv).toMatchObject({ companyObserved: 0, gains: 0, regressions: 0, changed: 0 });
});

test('empty eligible labels and bounded source failure remain non-promotable', () => {
  const fixture = inventoryCompanyFixture(1);
  const empty = benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: [] }, options);
  expect(empty).toMatchObject({ status: 'no_eligible_labels', sampleSize: 0, promotionAllowed: false });
  expect(() => benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: Array(5001).fill({}) }, options))
    .toThrow('inventory_outcome_label_budget');
  expect(() => benchmarkInventoryOutcomeCalibration({ ...fixture, feedbackRows: [] }, { ...options, folds: 0 }))
    .toThrow('grouped');
});

test('label query uses eligible explicit feedback without fetching raw titles or reasons', () => {
  expect(INVENTORY_OUTCOME_LABEL_SQL).toContain('policy_feedback_evaluation');
  expect(INVENTORY_OUTCOME_LABEL_SQL).toContain('classification_corrections');
  expect(INVENTORY_OUTCOME_LABEL_SQL).toContain('evaluation_correct IS NOT NULL');
  expect(INVENTORY_OUTCOME_LABEL_SQL).toContain('LIMIT 5001');
  expect(INVENTORY_OUTCOME_LABEL_SQL).not.toMatch(/title|reason|item_metadata/);
  expect(prepareInventoryOutcomeLabels([{ media_type: 'movie', tmdb_id: 3, selected_library_id: 1,
    was_correction: false }], [{ key: 'movie:3', libraryIds: [1] }], [{ id: 1, media_type: 'movie' }]).coverage.confirmations).toBe(1);
});
