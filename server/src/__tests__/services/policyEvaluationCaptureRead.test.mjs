/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildInventoryDisagreementReport } from '../../services/inventoryDisagreementReport.mjs';
import { readPolicyEvaluationContext } from '../../services/policyEvaluationCaptureRead.mjs';
import { validPolicyEvaluationCapture } from '../../services/policyEvaluationCaptureContract.mjs';
import { disagreementInputs, disagreementRow } from '../fixtures/inventoryDisagreementFixture.mjs';
import { persistedPolicyEvaluationFixture } from '../fixtures/policyEvaluationCaptureFixture.mjs';

const now = Date.parse('2026-10-28T18:00:00.000Z');
function fixture() { const row = disagreementRow(); row.policy_evaluation = persistedPolicyEvaluationFixture(row); return row; }

test('validated policy context is a distinct reference and leaves aggregate/cohort results unchanged', () => {
  const row = fixture(), legacy = buildInventoryDisagreementReport(disagreementInputs()), report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.evaluation).toEqual(legacy.evaluation); expect(report.cohorts).toEqual(legacy.cohorts);
  expect(report.cases[0].comparisons).toEqual(legacy.cases[0].comparisons);
  expect(report.cases[0].policyEvaluation).toMatchObject({ status: 'available', reference: 'retained_policy_evaluation',
    candidates: [{ policyId: 10, purposeProvenance: 'declared_native' }] });
  expect(report.policyEvaluationCoverage.available).toBe(1);
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|actor|credential|purposeRules/);
  expect(report.version).toBe('inventory_prospective_disagreements.v2');
});

test.each(['missing', 'expired', 'binding_failure', 'capture_invalid', 'pool_overflow'])('optional %s evidence stays a gap without changing labels', reason => {
  const row = fixture();
  if (reason === 'missing') delete row.policy_evaluation;
  if (reason === 'expired') { row.policy_evaluation.observedAt = '2026-09-28T17:57:30.000Z'; row.policy_evaluation.expiresAt = '2026-10-28T17:57:30.000Z'; }
  if (reason === 'binding_failure') row.policy_evaluation.classificationId = '2';
  if (reason === 'capture_invalid') row.policy_evaluation.payload.candidates[0].raw = 'PRIVATE RULE';
  if (reason === 'pool_overflow') { row.policy_evaluation.reasonId = reason; row.policy_evaluation.payload = null; }
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases[0].policyEvaluation).toEqual({ status: 'unavailable', reason });
  expect(report.policyEvaluationCoverage.gaps[reason]).toBe(1); expect(report.evaluation.sampleSize).toBe(1);
});

test.each(['version', 'time', 'duration', 'payloadIdentity', 'payloadTime', 'expiry', 'rank', 'authority'])('rejects %s drift without current policy reconstruction', kind => {
  const row = fixture(), record = row.policy_evaluation;
  if (kind === 'version') record.version = 3;
  if (kind === 'time') record.observedAt = '2026-12-28T18:00:00.000Z';
  if (kind === 'duration') record.expiresAt = '2026-12-28T18:00:00.000Z';
  if (kind === 'payloadIdentity') record.payload.identityKey = 'movie:43';
  if (kind === 'payloadTime') record.payload.capturedAt = '2026-10-28T17:57:31.000Z';
  if (kind === 'expiry') record.expiredAt = '2026-10-28T18:00:00.000Z';
  if (kind === 'rank') record.payload.ranked.push(record.payload.ranked[0]);
  if (kind === 'authority') record.payload.candidates[0].authority.validationOk = false;
  expect(readPolicyEvaluationContext(row, now).status).toBe('unavailable');
});

test('closed validator rejects invented disposition counts, raw fields and admission/declaration conflation', () => {
  const payload = fixture().policy_evaluation.payload;
  payload.exclusions.non_comparable = 1; expect(validPolicyEvaluationCapture(payload)).toBe(false);
  payload.exclusions.non_comparable = 0; payload.candidates[0].runtime.admission = 'declared_native';
  expect(validPolicyEvaluationCapture(payload)).toBe(false);
});

test('whole-cohort policy coverage precedes the 50-case and 1 MiB display caps', () => {
  const rows = Array.from({ length: 60 }, (_, index) => {
    const row = disagreementRow(index + 1, index + 100);
    row.policy_evaluation = persistedPolicyEvaluationFixture(row); return row;
  });
  const report = buildInventoryDisagreementReport(disagreementInputs(rows));
  expect(report.policyEvaluationCoverage.available).toBe(60); expect(report.display).toMatchObject({ shownCases: 50, omittedCases: 10 });
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(1024 * 1024);
});

test('complete 64-policy contexts enforce the byte ceiling with explicit whole-case omissions', () => {
  const rows = Array.from({ length: 60 }, (_, index) => {
    const row = disagreementRow(index + 1, index + 100), record = persistedPolicyEvaluationFixture(row);
    const candidate = record.payload.candidates[0], ranked = record.payload.ranked[0];
    record.payload.policyCount = 64;
    record.payload.candidates = Array.from({ length: 64 }, (_, i) => ({ ...candidate, policyId: i + 1, libraryId: i + 1 }));
    record.payload.ranked = Array.from({ length: 64 }, (_, i) => ({ ...ranked, policyId: i + 1, libraryId: i + 1 }));
    row.policy_evaluation = record; return row;
  });
  const report = buildInventoryDisagreementReport(disagreementInputs(rows));
  expect(report.policyEvaluationCoverage.available).toBe(60);
  expect(report.display.shownCases).toBeGreaterThan(0); expect(report.display.shownCases).toBeLessThan(50);
  expect(report.display.omittedCases).toBe(60 - report.cases.length);
  expect(report.cases[0].policyEvaluation.candidates).toHaveLength(64);
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(1024 * 1024);
});
