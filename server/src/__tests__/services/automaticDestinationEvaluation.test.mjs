/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { createAutomaticDestinationEvaluation, AUTOMATIC_DESTINATION_EVALUATION_LOCK } from '../../services/automaticDestinationEvaluation.mjs';
import { evaluateDestinationOutcomes } from '../../services/destinationOutcomeEvaluation.mjs';
import { readAutomaticDestinationEvaluationReport } from '../../services/automaticDestinationEvaluationReport.mjs';

function fixture() {
  const repository = { readState: jest.fn(async () => null),
    readSnapshot: jest.fn(async () => ({ observedAt: new Date(), inputs: { rows: [], intake: [] } })),
    save: jest.fn(), fail: jest.fn() };
  const evaluate = jest.fn(evaluateDestinationOutcomes);
  const withSessionAdvisoryLock = jest.fn(async (_key, callback) => { await callback(); return true; });
  const options = { repository, evaluate, withSessionAdvisoryLock };
  return { ...options, worker: createAutomaticDestinationEvaluation(options) };
}

test('evaluates once, then revalidates unchanged inputs without closing a pool or changing global settings', async () => {
  const env = { ...process.env };
  const f = fixture();
  expect(await f.worker.run()).toEqual({ status: 'evaluated' });
  const [input_fingerprint, report] = f.repository.save.mock.calls[0];
  expect(report).toMatchObject({ qualityStatus: 'no_completed_decision_labels', promotionAllowed: false, providerCalls: 0 });
  f.repository.readState.mockResolvedValue({ status: 'complete', input_fingerprint, report, cooling_down: false });
  expect(await f.worker.run()).toEqual({ status: 'unchanged' });
  expect(f.evaluate).toHaveBeenCalledTimes(1);
  expect(f.repository.save).toHaveBeenCalledTimes(2);
  expect(f.withSessionAdvisoryLock).toHaveBeenCalledWith(AUTOMATIC_DESTINATION_EVALUATION_LOCK, expect.any(Function));
  expect(process.env).toEqual(env);
});

test('changed or invalid stored evidence triggers a new evaluation, including after restart', async () => {
  const f = fixture(); await f.worker.run();
  const [input_fingerprint, report] = f.repository.save.mock.calls[0];
  f.repository.readState.mockResolvedValue({ status: 'complete', input_fingerprint, report: { ...report, private: 'forbidden' } });
  await createAutomaticDestinationEvaluation(f).run();
  f.repository.readState.mockResolvedValue({ status: 'complete', input_fingerprint, report });
  f.repository.readSnapshot.mockResolvedValue({ observedAt: new Date(), inputs: { rows: [], intake: [{ status_id: 'queued', classification_id: null, decision_context: null }] } });
  expect(await f.worker.run()).toEqual({ status: 'evaluated' });
  expect(f.evaluate).toHaveBeenCalledTimes(3);
});

test.each(['busy', 'cooldown'])('%s does no evidence reads or writes', async status => {
  const f = fixture();
  if (status === 'busy') f.withSessionAdvisoryLock.mockResolvedValue(false);
  else f.repository.readState.mockResolvedValue({ cooling_down: true });
  expect(await f.worker.run()).toEqual({ status });
  expect(f.repository.readSnapshot).not.toHaveBeenCalled(); expect(f.repository.save).not.toHaveBeenCalled();
});

test('a superseded publication is not reported as a newly saved evaluation', async () => {
  const f = fixture(); f.repository.save.mockResolvedValue(false);
  expect(await f.worker.run()).toEqual({ status: 'superseded' });
});

test('malformed prototype-like keys remain in the change fingerprint and cannot reuse a clean result', async () => {
  const f = fixture();
  f.repository.readSnapshot.mockResolvedValue({ observedAt: new Date(), inputs: { rows: [], intake: [{ decision_context: {} }] } });
  await f.worker.run(); const [input_fingerprint, report] = f.repository.save.mock.calls[0];
  f.repository.readState.mockResolvedValue({ status: 'complete', input_fingerprint, report });
  f.repository.readSnapshot.mockResolvedValue({ observedAt: new Date(), inputs: { rows: [],
    intake: [{ decision_context: JSON.parse('{"__proto__":{"private":"value"}}') }] } });
  expect(await f.worker.run()).toEqual({ status: 'evaluated' });
  expect(f.repository.save.mock.calls[1][0]).not.toBe(input_fingerprint);
});

test('unavailable database uses a local cooldown without affecting future recovery', async () => {
  const f = fixture(); let time = 1;
  const worker = createAutomaticDestinationEvaluation({ ...f, now: () => time });
  f.repository.readState.mockRejectedValueOnce(new Error('offline'));
  expect((await worker.run()).status).toBe('failed');
  expect((await worker.run()).status).toBe('cooldown');
  time += 300_000;
  expect((await worker.run()).status).toBe('evaluated');
});

test('nonfinite decoded JSON numbers cannot fingerprint as a valid null value', async () => {
  const f = fixture();
  f.repository.readSnapshot.mockResolvedValue({ observedAt: new Date(), inputs: { rows: [], intake: [{ decision_context: { tmdbId: Infinity } }] } });
  expect(await f.worker.run()).toEqual({ status: 'failed', reason: 'evaluation_unavailable' });
  expect(f.repository.save).not.toHaveBeenCalled();
});

test.each([
  ['saved_decisions_row_budget', 'evidence_budget'], ['saved_decisions_intake_budget', 'evidence_budget'],
  ['saved_decisions_feedback_invalid', 'invalid_feedback'], ['private data or credentials', 'evaluation_unavailable'],
])('failure %s persists only a fixed reason and retries later', async (message, reason) => {
  const f = fixture(); f.repository.readSnapshot.mockRejectedValueOnce(new Error(message));
  expect(await f.worker.run()).toEqual({ status: 'failed', reason });
  expect(f.repository.fail).toHaveBeenCalledWith(reason, expect.any(AbortSignal));
  expect(f.repository.save).not.toHaveBeenCalled();
  expect(await f.worker.run()).toEqual({ status: 'evaluated' });
});

test.each(['readState', 'fail', 'save'])('database failure in %s is advisory and redacted', async step => {
  const f = fixture(); f.repository[step].mockRejectedValue(new Error('private connection details'));
  if (step === 'fail') f.repository.readSnapshot.mockRejectedValue(new Error('private content'));
  expect(await f.worker.run()).toEqual({ status: 'failed', reason: 'evaluation_unavailable' });
});

test.each(['stop', 'lock'])('%s cancellation prevents publication and shares in-flight work', async cause => {
  const f = fixture(); const lock = new AbortController(); let finish;
  f.withSessionAdvisoryLock.mockImplementation(async (_key, callback) => { await callback({ signal: lock.signal }); return true; });
  f.repository.readSnapshot.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = f.worker.run(); expect(f.worker.run()).toBe(first);
  while (!finish) await Promise.resolve();
  if (cause === 'stop') f.worker.stop(); else lock.abort(new Error('private failure'));
  finish({ observedAt: new Date(), inputs: { rows: [], intake: [] } });
  expect((await first).status).toBe(cause === 'stop' ? 'stopped' : 'failed');
  expect(f.repository.save).not.toHaveBeenCalled(); expect(f.repository.fail).not.toHaveBeenCalled();
  if (cause === 'stop') expect(await f.worker.run()).toEqual({ status: 'stopped' });
});

test.each([null, [], {}, { private: 'secret' }])('rejects invalid aggregate %j', report => {
  expect(readAutomaticDestinationEvaluationReport(report)).toBeNull();
});
test('exact aggregate contract excludes arbitrary fields, invalid counts and routing claims', () => {
  const report = evaluateDestinationOutcomes([], []);
  expect(readAutomaticDestinationEvaluationReport(report)).toBe(report);
  for (const change of [{ status: 'untrusted' }, { uniqueDecisions: Infinity }, { uniqueDecisions: -1 }, { uniqueDecisions: 10001 },
    { uniqueDecisions: 0.5 }, { providerCalls: 1 }, { routingWrites: 1 }, { promotionAllowed: true }, { version: 'unknown' }, { private: 'secret' }]) {
    expect(readAutomaticDestinationEvaluationReport({ ...report, ...change })).toBeNull();
  }
  report.overall.labeledCohortAgreementRate = 0.5;
  expect(readAutomaticDestinationEvaluationReport(report)).toBe(report);
  report.overall.labeledCohortAgreementRate = 2;
  expect(readAutomaticDestinationEvaluationReport(report)).toBeNull();
});
