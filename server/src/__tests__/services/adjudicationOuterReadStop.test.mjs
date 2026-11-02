/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createAdjudicationBudgetWorker } from '../../services/adjudicationBudgetWorker.mjs';
import { createAdjudicationBudgetWorkerFixture as fixture } from '../helpers/adjudicationBudgetWorkerFixture.mjs';

test.each(['disabled', 'outside_window', 'cooldown', 'ready', 'missing', 'rejected'])
('permanent stop wins after pending outer read settles with %s', async mode => {
  const f = await fixture(), withAdmission = jest.fn(), withWorkload = jest.fn();
  let resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  f.budget.read.mockReturnValue(pending);
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission, withWorkload });
  let settled = false;
  const first = worker.run(); expect(worker.run()).toBe(first);
  const running = first.finally(() => { settled = true; });
  try {
    expect(f.budget.read).toHaveBeenCalledTimes(1);
    worker.stop(); await Promise.resolve(); expect(settled).toBe(false);
    expect(await worker.run()).toEqual({ status: 'stopped' });
    if (mode === 'disabled') f.state.daily_calls = 0;
    if (mode === 'outside_window') f.state.window_open = false;
    if (mode === 'cooldown') f.state.cooling_down = true;
    if (mode === 'rejected') reject(Error('Synthetic unreadable acknowledgement'));
    else resolve(mode === 'missing' ? undefined : f.state);
    expect(await running).toEqual({ status: 'stopped' });
    expect(await worker.run()).toEqual({ status: 'stopped' });
    expect(f.budget.read).toHaveBeenCalledTimes(1);
    expect(withAdmission).not.toHaveBeenCalled(); expect(withWorkload).not.toHaveBeenCalled();
    expect(f.repository.readState).not.toHaveBeenCalled(); expect(f.capture).not.toHaveBeenCalled();
    for (const method of ['reserve', 'checkpoint', 'finish', 'advance']) expect(f.budget[method]).not.toHaveBeenCalled();
    expect(f.budget.read.mock.calls[0][0].aborted).toBe(true);
  } finally { resolve(f.state); await running; worker.stop(); }
});

test.each([
  ['adjudication_budget_changed', 'deferred'],
  ['Synthetic read failure', 'unavailable'],
])('unstopped read failure retains classification and the five-minute retry boundary: %s', async (message, status) => {
  const f = await fixture(), withAdmission = jest.fn(); let clock = 100;
  f.budget.read.mockRejectedValueOnce(Error(message)).mockResolvedValue({ ...f.state, daily_calls: 0 });
  const worker = createAdjudicationBudgetWorker({ ...f.dependencies, withAdmission, now: () => clock });
  try {
    expect(await worker.run()).toEqual({ status });
    clock = 300099; expect(await worker.run()).toEqual({ status: 'cooldown' });
    expect(f.budget.read).toHaveBeenCalledTimes(1);
    clock = 300100; expect(await worker.run()).toEqual({ status: 'disabled' });
    expect(f.budget.read).toHaveBeenCalledTimes(2); expect(withAdmission).not.toHaveBeenCalled();
    expect(f.budget.finish).not.toHaveBeenCalled();
  } finally { worker.stop(); }
});
